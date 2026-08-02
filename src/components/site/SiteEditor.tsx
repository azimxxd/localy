'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { saveBusinessSite, type SiteEditorInput } from '@/app/(app)/dashboard/site/actions';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { kzt, num } from '@/lib/format';
import { accessibleBrandColor, brandOnDarkColor, contrastTextColor } from '@/lib/site-theme';
import type { CatalogItem, LoyaltyConfig, SiteConfig, SiteSection, Template } from '@/lib/types';

const TEMPLATE_ACCENT: Record<string, { label: string; art: string }> = {
  tpl_site_coffee: { label: 'Кофейня', art: "  ( (\\n   ) )\\n........\\n|      |]\\n\\\\      /\\n  ----" },
  tpl_site_barber: { label: 'Барбершоп', art: "  /\\\\ /\\\\\\n (  X  )\\n  \\\\/ \\\\/" },
  tpl_site_beauty: { label: 'Студия красоты', art: "  .-*-.\\n /  |  \\\\\\n*---+---*\\n \\\\  |  /\\n  -*-" },
  tpl_site_flower: { label: 'Цветы', art: "  .-.\\n (   )\\n   |\\n \\\\ | /\\n  \\\\|/" },
  tpl_site_retail: { label: 'Магазин', art: "+-------+\\n| [___] |\\n|_______|" },
  tpl_site_repair: { label: 'Сервис', art: "---[====]---\\n    ||\\n   /__\\\\" },
};

const SITE_FONT_CLASS: Record<SiteEditorInput['fontStyle'], string> = {
  clean: '[font-family:Inter,ui-sans-serif,system-ui,sans-serif]',
  editorial: 'font-display',
  friendly: 'font-sans',
};

function Preview({ value, businessCity, loyalty }: { value: SiteEditorInput; businessCity: string; loyalty: LoyaltyConfig }) {
  const theme = TEMPLATE_ACCENT[value.templateId] ?? TEMPLATE_ACCENT.tpl_site_coffee;
  const enabled = value.sections.filter((section) => section.enabled);
  const catalog = value.catalog.filter((item) => item.active);
  const readableBrand = accessibleBrandColor(value.primaryColor);
  const heroBrand = value.coverUrl ? brandOnDarkColor(value.primaryColor) : readableBrand;
  const socialLabels = value.socials.split(',').map((item) => item.split(':')[0].trim()).filter(Boolean);
  return (
    <div data-site-preview className={`overflow-hidden border border-line bg-canvas text-ink ${SITE_FONT_CLASS[value.fontStyle]}`} style={{ '--color-brand': readableBrand } as CSSProperties}>
      <div className="border-b border-line bg-surface px-4 py-2 text-xs text-ink-soft">● ● ● &nbsp; localy.site/preview</div>
      <div data-site-preview-hero className="relative border-b bg-surface bg-cover bg-center px-7 py-10 text-center" style={{ ...(value.coverUrl ? { backgroundImage: `linear-gradient(rgba(8,12,5,.78),rgba(8,12,5,.9)),url(${value.coverUrl})` } : {}), borderColor: value.primaryColor, boxShadow: `inset 0 5px 0 ${value.primaryColor}` }}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: heroBrand }}>{theme.label}</p>
        {value.logoUrl ? <div aria-label="Логотип" className="mx-auto my-5 h-20 w-20 border bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${value.logoUrl})`, borderColor: heroBrand }} /> : <pre aria-hidden className="my-5 whitespace-pre font-mono text-sm leading-tight" style={{ color: heroBrand }}>{theme.art.replaceAll('\\n', '\n')}</pre>}
        <h2 className="text-3xl font-bold uppercase" style={{ color: heroBrand }}>{value.name || 'Название бизнеса'}</h2>
        <p className={`mt-2 text-sm ${value.coverUrl ? 'text-[#eee7da]' : 'text-ink-soft'}`}>{businessCity}</p>
        <p className={`mx-auto mt-2 max-w-md text-sm ${value.coverUrl ? 'text-[#eee7da]' : 'text-ink-soft'}`}>{value.description || 'Кратко расскажите, почему к вам стоит прийти.'}</p>
        <button type="button" className="mt-5 border px-4 py-2 text-sm font-semibold uppercase" style={{ backgroundColor: value.primaryColor, borderColor: value.primaryColor, color: contrastTextColor(value.primaryColor) }}>Получить бонусную карту</button>
      </div>
      <div className="space-y-5 bg-surface p-6">
        <section className="border border-line p-4"><p className="font-semibold text-ink">Бонусная программа</p><p className="mt-1 text-sm text-ink-soft">{Math.round(loyalty.pointsPerCurrency * 100)}% бонусами с каждой покупки. Накопите {num(loyalty.rewardThreshold)} — получите «{loyalty.rewardTitle}».</p></section>
        {catalog.length > 0 ? (
          <section data-site-preview-catalog>
            <p className="mb-2 text-sm font-semibold uppercase text-brand">{value.catalogTitle || 'Каталог'}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {catalog.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 border border-line p-3">
                  <div><p className="text-sm font-medium text-ink">{item.title}</p><p className="text-xs uppercase text-brand">{item.category || 'Без категории'}</p>{item.description ? <p className="mt-1 text-xs text-ink-soft">{item.description}</p> : null}</div>
                  <strong className="shrink-0 text-sm text-ink">{kzt(item.price)}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {value.galleryUrls.length ? <section><p className="mb-2 font-semibold uppercase text-brand">Фото</p><div className="grid grid-cols-3 gap-2">{value.galleryUrls.map((url, index) => <div key={`${url.slice(0, 24)}_${index}`} className="aspect-video border border-line bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />)}</div></section> : null}
        {enabled.filter((section) => !['hero', 'services', 'promos', 'loyalty', 'contacts', 'booking', 'lead'].includes(section.kind)).map((section) => (
          <section key={section.kind} className="border border-line p-4">
            <p className="font-semibold text-ink">{section.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{section.body}</p>
          </section>
        ))}
        <div className="border border-line p-4 text-xs text-ink-soft"><p className="font-semibold text-ink">График и связь</p><p>{value.workHours} {value.phone ? `· ${value.phone}` : ''}</p>{socialLabels.length ? <p className="mt-1 text-brand">{socialLabels.join(' · ')}</p> : null}</div>
      </div>
    </div>
  );
}

export default function SiteEditor({
  businessId,
  businessName,
  businessCity,
  loyalty,
  initial,
  templates,
}: {
  businessId: string;
  businessName: string;
  businessCity: string;
  loyalty: LoyaltyConfig;
  initial: SiteConfig;
  templates: Template[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [value, setValue] = useState<SiteEditorInput>({
    businessId,
    name: businessName,
    description: initial.description ?? '',
    coverUrl: initial.coverUrl ?? null,
    logoUrl: initial.logoUrl ?? null,
    galleryUrls: initial.galleryUrls ?? [],
    templateId: initial.templateId,
    primaryColor: initial.primaryColor ?? '#2f6f5e',
    phone: initial.phone ?? '',
    workHours: initial.workHours ?? 'Ежедневно, 08:00–22:00',
    socials: (initial.socials ?? [initial.instagram && `Instagram: ${initial.instagram}`, initial.whatsapp && `WhatsApp: ${initial.whatsapp}`, initial.telegram && `Telegram: ${initial.telegram}`].filter((item): item is string => Boolean(item))).join(', '),
    fontStyle: initial.fontStyle ?? 'clean',
    catalogTitle: initial.catalogTitle ?? initial.sections.find((section) => section.kind === 'services')?.title ?? (initial.templateId === 'tpl_site_coffee' ? 'Меню' : 'Каталог'),
    sections: initial.sections,
    catalog: initial.catalog ?? [],
    published: initial.published,
  });
  const siteTemplates = useMemo(() => templates.filter((template) => template.kind === 'site'), [templates]);

  const patch = <K extends keyof SiteEditorInput>(key: K, next: SiteEditorInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));
  const patchSection = (index: number, next: Partial<SiteSection>) =>
    patch('sections', value.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...next } : section));
  const patchItem = (index: number, next: Partial<CatalogItem>) =>
    patch('catalog', value.catalog.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));

  function save(nextPublished = value.published) {
    setMessage(null);
    const payload = { ...value, published: nextPublished };
    startTransition(async () => {
      try {
        await saveBusinessSite(payload);
        setValue(payload);
        setMessage(nextPublished ? 'Сайт опубликован и данные сохранены' : 'Черновик сохранён');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Не удалось сохранить');
      }
    });
  }

  function readImage(file: File, done: (url: string) => void) {
    if (!file.type.startsWith('image/')) { setMessage('Выберите файл изображения'); return; }
    if (file.size > 350_000) { setMessage('Файл должен быть меньше 350 КБ'); return; }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && done(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.9fr)]">
      <div className="space-y-4">
        <Card className="space-y-4">
          <div><h2 className="font-semibold text-ink">Основа сайта</h2><p className="text-sm text-ink-soft">Изменения сразу видны в предпросмотре.</p></div>
          <div className="grid gap-3 md:grid-cols-3">
            <TextInput label="Название" value={value.name} onChange={(event) => patch('name', event.target.value)} />
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Фирменный цвет</span><input type="color" value={value.primaryColor} onChange={(event) => patch('primaryColor', event.target.value)} className="h-11 w-full border border-line bg-surface p-1" /><span className="mt-1 block text-xs text-ink-soft">Текст автоматически станет контрастным.</span></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Шрифт сайта</span><select value={value.fontStyle} onChange={(event) => patch('fontStyle', event.target.value as SiteEditorInput['fontStyle'])} className="h-11 w-full border border-line bg-surface px-3"><option value="clean">Чистый</option><option value="editorial">Редакционный</option><option value="friendly">Дружелюбный</option></select></label>
          </div>
          <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Короткое описание</span><textarea value={value.description} onChange={(event) => patch('description', event.target.value)} rows={3} className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 outline-none focus:border-brand" /></label>
          <div className="grid gap-2 md:grid-cols-2">
            {siteTemplates.map((template) => (
              <button type="button" key={template.id} onClick={() => patch('templateId', template.id)} className={`rounded-xl border p-3 text-left ${value.templateId === template.id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-canvas'}`}>
                <span className="block text-sm font-semibold text-ink">{template.title}</span><span className="block text-xs text-ink-soft">{template.body}</span>
              </button>
            ))}
          </div>
        </Card>

        <details className="ascii-details border border-line bg-surface p-5">
          <summary className="font-semibold uppercase tracking-wide text-ink">Логотип и фото</summary>
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <p className="text-sm text-ink-soft">Необязательно. JPG, PNG, WebP или SVG до 350 КБ; файлы хранятся вместе с демо-данными.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <AssetPicker label="Логотип" value={value.logoUrl} onPick={(url) => patch('logoUrl', url)} onRemove={() => patch('logoUrl', null)} readImage={readImage} />
              <AssetPicker label="Обложка" value={value.coverUrl} onPick={(url) => patch('coverUrl', url)} onRemove={() => patch('coverUrl', null)} readImage={readImage} />
            </div>
            <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Галерея ({value.galleryUrls.length}/6)</p><label className="cursor-pointer border border-line px-3 py-2 text-xs uppercase hover:border-brand"><input className="sr-only" type="file" accept="image/*" disabled={value.galleryUrls.length >= 6} onChange={(event) => { const file = event.target.files?.[0]; if (file) readImage(file, (url) => patch('galleryUrls', [...value.galleryUrls, url])); event.target.value = ''; }} />+ фото</label></div><div className="grid grid-cols-3 gap-2">{value.galleryUrls.map((url, index) => <button type="button" aria-label={`Удалить фото ${index + 1}`} title="Удалить" key={`${url.slice(0, 24)}_${index}`} className="aspect-video border border-line bg-cover bg-center hover:border-danger" style={{ backgroundImage: `url(${url})` }} onClick={() => patch('galleryUrls', value.galleryUrls.filter((_, itemIndex) => itemIndex !== index))} />)}</div></div>
          </div>
        </details>

        <details className="ascii-details border border-line bg-surface p-5">
          <summary className="font-semibold uppercase tracking-wide text-ink">Каталог ({value.catalog.length})</summary>
          <div className="mt-4 space-y-3 border-t border-line pt-4"><div className="flex items-end gap-3"><div className="min-w-0 flex-1"><TextInput label="Заголовок каталога" value={value.catalogTitle} onChange={(event) => patch('catalogTitle', event.target.value)} hint="Меняет общий заголовок на сайте: например, «Меню» или «Услуги»." /></div><Button type="button" variant="secondary" onClick={() => patch('catalog', [...value.catalog, { id: `item_${Date.now()}`, title: '', description: '', category: 'Основное', price: 0, active: true }])}>Добавить</Button></div><p className="text-sm text-ink-soft">Категория ниже — это подпись и группа конкретного товара, а не заголовок всего блока.</p></div>
          {value.catalog.map((item, index) => (
            <div key={item.id} className="grid gap-2 rounded-xl border border-line p-3 md:grid-cols-[1fr_10rem_auto]">
              <TextInput label="Название" aria-label="Название позиции" value={item.title} onChange={(event) => patchItem(index, { title: event.target.value })} placeholder="Название" />
              <TextInput label="Цена, ₸" aria-label="Цена" type="number" min="0" value={item.price} onChange={(event) => patchItem(index, { price: Number(event.target.value) })} />
              <Button type="button" variant="ghost" onClick={() => patch('catalog', value.catalog.filter((_, itemIndex) => itemIndex !== index))}>Удалить</Button>
              <TextInput label="Категория позиции" aria-label="Категория" value={item.category} onChange={(event) => patchItem(index, { category: event.target.value })} placeholder="Напитки, стрижки, букеты…" />
              <div className="md:col-span-2"><TextInput label="Описание" aria-label="Описание" value={item.description} onChange={(event) => patchItem(index, { description: event.target.value })} placeholder="Короткое описание" /></div>
              <label className="flex items-center gap-2 text-xs uppercase text-ink-soft"><input type="checkbox" checked={item.active} onChange={(event) => patchItem(index, { active: event.target.checked })} /> показывать</label>
            </div>
          ))}
        </details>

        <details className="ascii-details border border-line bg-surface p-5">
          <summary className="font-semibold uppercase tracking-wide text-ink">Секции страницы</summary>
          <div className="mt-4 space-y-3 border-t border-line pt-4">
          {value.sections.map((section, index) => (
            <div key={section.kind} className="rounded-xl border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink"><input type="checkbox" checked={section.enabled} onChange={(event) => patchSection(index, { enabled: event.target.checked })} className="accent-brand" />{section.title || section.kind}</label>
              {section.enabled ? <div className="mt-2 grid gap-2"><TextInput value={section.title} onChange={(event) => patchSection(index, { title: event.target.value })} /><textarea value={section.body} onChange={(event) => patchSection(index, { body: event.target.value })} rows={2} className="rounded-xl border border-line px-3 py-2 text-sm" /></div> : null}
            </div>
          ))}
          </div>
        </details>

        <details className="ascii-details border border-line bg-surface p-5">
          <summary className="font-semibold uppercase tracking-wide text-ink">Контакты</summary>
          <div className="mt-4 border-t border-line pt-4">
          <div className="grid gap-3 md:grid-cols-2"><TextInput label="Телефон" value={value.phone} onChange={(event) => patch('phone', event.target.value)} /><TextInput label="График" value={value.workHours} onChange={(event) => patch('workHours', event.target.value)} /><div className="md:col-span-2"><TextInput label="Соцсети и площадки" value={value.socials} onChange={(event) => patch('socials', event.target.value)} hint="Через запятую: Instagram: @name, WhatsApp: +7…, Telegram: @name, TikTok, 2GIS" /></div></div>
          </div>
        </details>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <div className="mb-3 flex items-center justify-between"><div><p className="font-semibold text-ink">Живой предпросмотр</p><Badge tone={value.published ? 'success' : 'muted'}>{value.published ? 'Опубликован' : 'Черновик'}</Badge></div><div className="flex gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={() => save(false)}>Сохранить</Button><Button type="button" disabled={pending} onClick={() => save(true)}>Опубликовать</Button></div></div>
        {message ? <p role="status" className="mb-3 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">{message}</p> : null}
        <Preview value={value} businessCity={businessCity} loyalty={loyalty} />
      </div>
    </div>
  );
}

function AssetPicker({ label, value, onPick, onRemove, readImage }: { label: string; value: string | null; onPick: (url: string) => void; onRemove: () => void; readImage: (file: File, done: (url: string) => void) => void }) {
  return <div className="border border-line p-3"><p className="mb-2 text-sm font-medium">{label}</p>{value ? <div className="mb-2 aspect-video border border-line bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${value})` }} /> : <div className="mb-2 grid aspect-video place-items-center border border-dashed border-line text-xs text-ink-soft">[ нет файла ]</div>}<div className="flex gap-2"><label className="cursor-pointer border border-line px-3 py-2 text-xs uppercase hover:border-brand"><input className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImage(file, onPick); event.target.value = ''; }} />Выбрать</label>{value ? <Button type="button" variant="ghost" onClick={onRemove}>Убрать</Button> : null}</div></div>;
}
