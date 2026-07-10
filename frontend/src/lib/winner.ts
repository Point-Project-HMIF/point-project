// ngubah nama tim jadi URL slug — dipake di halaman detail pemenang
export function teamSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function winnerPath(eventId: string, teamName: string) {
  return `/pengumuman/${eventId}/${teamSlug(teamName)}`;
}

export function announcementPath(eventId: string, announcementId: string) {
  return `/pengumuman/${eventId}/berita/${announcementId}`;
}
