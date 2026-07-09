delete from faqs
where lower(question) = lower('Jumlah minimal dan maksimal peserta per tim');

update faqs
set sort_order = 1,
    updated_at = now()
where lower(question) = lower('Jumlah minimal peserta per tim');

update faqs
set sort_order = 2,
    updated_at = now()
where lower(question) = lower('Jumlah maksimal peserta per tim');

update faqs
set question = 'Berkas yang perlu disiapkan',
    sort_order = 3,
    updated_at = now()
where lower(question) = lower('Apa saja berkas yang perlu disiapkan?');

update faqs
set sort_order = 4,
    updated_at = now()
where lower(question) = lower('Template aturan tambahan');
