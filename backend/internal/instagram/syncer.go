package instagram

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"pointproject/backend/internal/models"
)

type Store interface {
	ListEvents(ctx context.Context) ([]models.Event, error)
	UpsertInstagramAnnouncements(ctx context.Context, items []models.InstagramAnnouncementInput) (int, error)
}

type Config struct {
	APIKey          string
	UserID          string
	OldestTimestamp int64
	ChunkSize       int
	SyncInterval    time.Duration
}

type Syncer struct {
	store  Store
	client *http.Client
	config Config
}

type mediaItem struct {
	SourceID    string
	SourceURL   string
	ImageURL    string
	MediaType   string
	Caption     string
	PublishedAt time.Time
}

const apiRoot = "https://ensembledata.com/apis"

func NewSyncer(store Store, config Config) *Syncer {
	config.APIKey = strings.TrimSpace(config.APIKey)
	config.UserID = strings.TrimSpace(config.UserID)
	if config.ChunkSize <= 0 {
		config.ChunkSize = 10
	}
	if config.OldestTimestamp <= 0 {
		config.OldestTimestamp = 1666262030
	}
	if config.SyncInterval <= 0 {
		config.SyncInterval = 30 * time.Minute
	}
	return &Syncer{
		store:  store,
		client: &http.Client{Timeout: 25 * time.Second},
		config: config,
	}
}

func (s *Syncer) Configured() bool {
	return s != nil && s.store != nil && s.config.APIKey != "" && s.config.UserID != ""
}

func (s *Syncer) Interval() time.Duration {
	if s == nil || s.config.SyncInterval <= 0 {
		return 0
	}
	return s.config.SyncInterval
}

func (s *Syncer) Sync(ctx context.Context) (models.InstagramSyncResult, error) {
	var result models.InstagramSyncResult
	if !s.Configured() {
		return result, fmt.Errorf("sinkronisasi Instagram belum dikonfigurasi")
	}

	events, err := s.store.ListEvents(ctx)
	if err != nil {
		return result, err
	}
	eventByYear := map[int]string{}
	for _, event := range events {
		if event.Status == "draft" {
			continue
		}
		eventByYear[event.Year] = event.ID
	}

	items, err := s.fetchAll(ctx)
	if err != nil {
		return result, err
	}
	result.Fetched = len(items)

	seen := map[string]bool{}
	inputs := make([]models.InstagramAnnouncementInput, 0, len(items))
	for _, item := range items {
		if item.SourceID == "" || item.PublishedAt.IsZero() {
			result.Skipped++
			continue
		}
		key := strings.ToLower(item.SourceID)
		if seen[key] {
			result.Skipped++
			continue
		}
		seen[key] = true

		eventID := eventByYear[item.PublishedAt.Year()]
		if eventID == "" {
			result.Skipped++
			continue
		}
		title := titleFromCaption(item.Caption)
		inputs = append(inputs, models.InstagramAnnouncementInput{
			EventID:     eventID,
			SourceID:    key,
			SourceURL:   item.SourceURL,
			ImageURL:    item.ImageURL,
			MediaType:   item.MediaType,
			Title:       title,
			Body:        strings.TrimSpace(item.Caption),
			PublishedAt: item.PublishedAt,
		})
	}

	saved, err := s.store.UpsertInstagramAnnouncements(ctx, inputs)
	if err != nil {
		return result, err
	}
	result.Saved = saved
	return result, nil
}

func (s *Syncer) fetchAll(ctx context.Context) ([]mediaItem, error) {
	var all []mediaItem
	for _, endpoint := range []string{"/instagram/user/posts", "/instagram/user/reels"} {
		cursor := ""
		seenCursors := map[string]bool{}
		for page := 0; page < 6; page++ {
			payload, nextCursor, err := s.fetchEndpoint(ctx, endpoint, cursor)
			if err != nil {
				return all, err
			}
			kind := "post"
			if strings.Contains(endpoint, "reels") {
				kind = "reel"
			}
			collectMediaItems(payload, kind, &all)
			nextCursor = strings.TrimSpace(nextCursor)
			if nextCursor == "" || seenCursors[nextCursor] {
				break
			}
			seenCursors[nextCursor] = true
			cursor = nextCursor
		}
	}
	return all, nil
}

func (s *Syncer) fetchEndpoint(ctx context.Context, endpoint, cursor string) (any, string, error) {
	values := url.Values{}
	values.Set("user_id", s.config.UserID)
	values.Set("depth", "1")
	values.Set("oldest_timestamp", strconv.FormatInt(s.config.OldestTimestamp, 10))
	values.Set("chunk_size", strconv.Itoa(s.config.ChunkSize))
	values.Set("start_cursor", cursor)
	values.Set("token", s.config.APIKey)
	if strings.Contains(endpoint, "posts") {
		values.Set("alternative_method", "false")
	}
	if strings.Contains(endpoint, "reels") {
		values.Set("include_feed_video", "true")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiRoot+endpoint+"?"+values.Encode(), nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("ensembledata %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, "", err
	}
	return payload, findNextCursor(payload), nil
}

func collectMediaItems(value any, mediaType string, out *[]mediaItem) {
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			collectMediaItems(item, mediaType, out)
		}
	case map[string]any:
		if item := extractMediaItem(typed, mediaType); item.SourceID != "" && (item.Caption != "" || item.SourceURL != "" || item.ImageURL != "") {
			*out = append(*out, item)
		}
		for _, child := range typed {
			collectMediaItems(child, mediaType, out)
		}
	}
}

func extractMediaItem(raw map[string]any, fallbackType string) mediaItem {
	shortcode := firstString(raw, "shortcode", "code")
	sourceID := shortcode
	if sourceID == "" {
		sourceID = firstString(raw, "id", "pk", "media_id")
	}
	if sourceID == "" {
		return mediaItem{}
	}

	caption := firstCaption(raw)
	publishedAt := firstTimestamp(raw)
	sourceURL := firstInstagramURL(raw)
	if sourceURL == "" && shortcode != "" {
		sourceURL = "https://www.instagram.com/p/" + shortcode + "/"
	}
	imageURL := firstImageURL(raw)
	mediaType := strings.ToLower(firstString(raw, "product_type", "media_type_name", "type"))
	if mediaType == "" {
		mediaType = fallbackType
	}
	return mediaItem{
		SourceID:    sourceID,
		SourceURL:   sourceURL,
		ImageURL:    imageURL,
		MediaType:   mediaType,
		Caption:     caption,
		PublishedAt: publishedAt,
	}
}

func firstString(raw map[string]any, keys ...string) string {
	for _, key := range keys {
		if value := stringValue(raw[key]); value != "" {
			return value
		}
	}
	return ""
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case int64:
		return strconv.FormatInt(typed, 10)
	case json.Number:
		return typed.String()
	}
	return ""
}

func firstCaption(raw map[string]any) string {
	for _, key := range []string{"caption_text", "caption", "text", "title", "accessibility_caption"} {
		if text := captionValue(raw[key]); text != "" {
			return text
		}
	}
	if edge, ok := raw["edge_media_to_caption"].(map[string]any); ok {
		if edges, ok := edge["edges"].([]any); ok && len(edges) > 0 {
			if edgeItem, ok := edges[0].(map[string]any); ok {
				if node, ok := edgeItem["node"].(map[string]any); ok {
					return captionValue(node["text"])
				}
			}
		}
	}
	return ""
}

func captionValue(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case map[string]any:
		for _, key := range []string{"text", "caption", "body"} {
			if text := captionValue(typed[key]); text != "" {
				return text
			}
		}
	}
	return ""
}

func firstTimestamp(raw map[string]any) time.Time {
	for _, key := range []string{"taken_at_timestamp", "taken_at", "timestamp", "created_at", "date"} {
		if date := timestampValue(raw[key]); !date.IsZero() {
			return date
		}
	}
	return time.Time{}
}

func timestampValue(value any) time.Time {
	switch typed := value.(type) {
	case float64:
		return time.Unix(int64(typed), 0).UTC()
	case int64:
		return time.Unix(typed, 0).UTC()
	case string:
		text := strings.TrimSpace(typed)
		if text == "" {
			return time.Time{}
		}
		if number, err := strconv.ParseInt(text, 10, 64); err == nil {
			return time.Unix(number, 0).UTC()
		}
		for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05Z07:00", "2006-01-02"} {
			if parsed, err := time.Parse(layout, text); err == nil {
				return parsed.UTC()
			}
		}
	}
	return time.Time{}
}

func firstInstagramURL(raw map[string]any) string {
	for _, key := range []string{"permalink", "post_url", "share_url", "link", "url"} {
		value := strings.TrimSpace(captionValue(raw[key]))
		if strings.Contains(value, "instagram.com") {
			return value
		}
	}
	return ""
}

func firstImageURL(raw map[string]any) string {
	for _, key := range []string{"display_url", "thumbnail_url", "thumbnail_src", "image_url", "cover_frame_url"} {
		value := strings.TrimSpace(captionValue(raw[key]))
		if strings.HasPrefix(value, "http") {
			return value
		}
	}
	if versions, ok := raw["image_versions2"].(map[string]any); ok {
		if candidate := firstCandidateURL(versions["candidates"]); candidate != "" {
			return candidate
		}
	}
	if candidate := firstCandidateURL(raw["carousel_media"]); candidate != "" {
		return candidate
	}
	return ""
}

func firstCandidateURL(value any) string {
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			switch candidate := item.(type) {
			case map[string]any:
				if url := firstImageURL(candidate); url != "" {
					return url
				}
				if url := strings.TrimSpace(captionValue(candidate["url"])); strings.HasPrefix(url, "http") {
					return url
				}
			}
		}
	case map[string]any:
		return firstImageURL(typed)
	}
	return ""
}

func findNextCursor(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		for _, key := range []string{"next_cursor", "nextCursor", "end_cursor", "cursor"} {
			if cursor := stringValue(typed[key]); cursor != "" {
				return cursor
			}
		}
		for _, child := range typed {
			if cursor := findNextCursor(child); cursor != "" {
				return cursor
			}
		}
	case []any:
		for _, child := range typed {
			if cursor := findNextCursor(child); cursor != "" {
				return cursor
			}
		}
	}
	return ""
}

func titleFromCaption(caption string) string {
	caption = strings.TrimSpace(caption)
	if caption == "" {
		return "Update Instagram Point Project"
	}
	for _, line := range strings.Split(caption, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if len([]rune(line)) > 96 {
			runes := []rune(line)
			line = string(runes[:93]) + "..."
		}
		return line
	}
	return "Update Instagram Point Project"
}
