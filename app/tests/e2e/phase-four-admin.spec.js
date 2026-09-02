import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  authenticateTestAdmin,
  loginAsTestAdmin,
  resetPocketBaseFixture,
} from './support/pocketbase-fixture.mjs'
import { TEST_ADMIN, TEST_POST } from './support/test-data.mjs'

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

const imageFile = (name) => ({ name, mimeType: 'image/png', buffer: onePixelPng })

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await resetPocketBaseFixture()
})

test('provede celý životní cyklus článku včetně média a historie slugu', async ({ page }) => {
  await loginAsTestAdmin(page)
  await page.getByRole('link', { name: 'Nový článek' }).click()

  await page.getByLabel('Název').fill('Článek z administrace')
  await expect(page.getByLabel('Adresa článku (slug)')).toHaveValue('clanek-z-administrace')
  await page.getByLabel('Perex').fill('První perex z prohlížečového testu.')
  await page.getByLabel('Cesty & příběhy').check()
  await page.getByRole('textbox', { name: 'Obsah článku' }).fill('První bezpečný obsah článku.')
  await page.getByLabel('Nahrát nový obrázek').setInputFiles(imageFile('cover.png'))
  await expect(page.getByText(/Titulní obrázek je připravený/)).toBeVisible()
  await page.getByRole('button', { name: 'Uložit koncept' }).click()
  await page.waitForURL(/\/admin\/blog\/[a-z0-9]{15}\/edit/)
  const editUrl = page.url()
  const postId = editUrl.match(/\/blog\/([a-z0-9]{15})\/edit/)?.[1]
  expect(postId).toBeTruthy()

  await page.getByRole('button', { name: 'Vložit obrázek' }).click()
  const imageDialog = page.getByRole('dialog', { name: 'Vložit obrázek' })
  await imageDialog.getByLabel('Soubor').setInputFiles(imageFile('inline.png'))
  await imageDialog.getByLabel('Alternativní text').fill('Zlatý testovací bod v článku')
  await imageDialog.getByLabel('Šířka v procentech').fill('60')
  await imageDialog.getByRole('button', { name: 'Použít obrázek' }).click()
  await expect(imageDialog).toBeHidden()

  await page.getByRole('button', { name: 'Publikovat' }).click()
  await expect(page.getByText('Článek je uložený a publikovaný.')).toBeVisible()

  await page.goto('/blog/clanek-z-administrace')
  await expect(page.getByRole('heading', { name: 'Článek z administrace' })).toBeVisible()
  const inlineImage = page.getByRole('img', { name: 'Zlatý testovací bod v článku' })
  await expect(inlineImage).toBeVisible()
  await expect.poll(() => inlineImage.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0)

  await page.goto(editUrl)
  await page.getByLabel('Adresa článku (slug)').fill('nova-adresa-clanku')
  await expect(page.getByText(/původní adresa \/blog\/clanek-z-administrace/)).toBeVisible()
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(page.getByText('Článek je uložený a publikovaný.')).toBeVisible()
  await page.goto('/blog/clanek-z-administrace')
  await page.waitForURL('**/blog/nova-adresa-clanku')

  await page.goto(editUrl)
  await page.getByLabel('Adresa článku (slug)').fill('clanek-z-administrace')
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(page.getByText('Článek je uložený a publikovaný.')).toBeVisible()

  await page.getByRole('button', { name: 'Skrýt' }).click()
  await expect(page.getByText('Článek je uložený a skrytý.')).toBeVisible()
  await page.goto('/blog/clanek-z-administrace')
  await expect(page.getByRole('heading', { name: 'Obsah nebyl nalezen.' })).toBeVisible()

  await page.goto(editUrl)
  await page.getByRole('button', { name: 'Znovu publikovat' }).click()
  await expect(page.getByText('Článek je uložený a publikovaný.')).toBeVisible()
  await page.getByRole('button', { name: 'Trvale smazat' }).click()
  const deleteDialog = page.getByRole('dialog', { name: 'Trvale smazat článek?' })
  await deleteDialog.getByRole('button', { name: 'Trvale smazat' }).click()
  await page.waitForURL('**/admin/blog')
  await expect(page.getByRole('heading', { name: 'Článek z administrace' })).toHaveCount(0)
})

test('zachová lokální obsah při vypršení přihlášení i konfliktu', async ({ page }) => {
  await loginAsTestAdmin(page)
  const admin = await authenticateTestAdmin()
  const post = await admin
    .collection('posts')
    .getFirstListItem(admin.filter('slug = {:slug}', { slug: TEST_POST.slug }))
  await page.goto(`/admin/blog/${post.id}/edit`)
  await page.getByLabel('Perex').fill('Lokální změna, která se nesmí ztratit.')
  await page.getByRole('link', { name: 'Blog', exact: true }).click()
  const dirtyDialog = page.getByRole('dialog', { name: 'Neuložené změny' })
  await expect(dirtyDialog).toBeVisible()
  await dirtyDialog.getByRole('button', { name: 'Zůstat' }).click()
  await expect(page.getByLabel('Perex')).toHaveValue('Lokální změna, která se nesmí ztratit.')

  await page.route('**/api/monike/posts/save', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ status: 401, message: 'Expired' }),
  }))
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  const reauth = page.getByRole('dialog', { name: 'Přihlášení vypršelo' })
  await expect(reauth).toBeVisible()
  await page.unroute('**/api/monike/posts/save')
  await reauth.getByLabel('Heslo').fill(TEST_ADMIN.password)
  await reauth.getByRole('button', { name: 'Přihlásit znovu' }).click()
  await expect(reauth).toBeHidden()
  await expect(page.getByLabel('Perex')).toHaveValue('Lokální změna, která se nesmí ztratit.')
  expect((await admin.collection('posts').getOne(post.id)).excerpt).toBe(TEST_POST.excerpt)

  const external = await admin.send('/api/monike/posts/save', {
    method: 'POST',
    body: {
      id: post.id,
      expectedUpdated: post.updated,
      title: post.title,
      slug: post.slug,
      excerpt: 'Změna z druhé karty.',
      labels: post.labels,
      content_json: post.content_json,
      published: post.published,
    },
  })
  expect(external.record.updated).not.toBe(post.updated)
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(page.getByText(/mezitím změněn v jiné kartě/)).toBeVisible()
  await expect(page.getByLabel('Perex')).toHaveValue('Lokální změna, která se nesmí ztratit.')
})

test('spravuje labely a bezpečně blokuje smazání použitého labelu', async ({ page }) => {
  await loginAsTestAdmin(page)
  await page.getByRole('link', { name: 'Labels', exact: true }).click()

  await page.getByLabel('Název nového labelu').fill('Novinky')
  await expect(page.getByLabel('Slug nového labelu')).toHaveValue('novinky')
  await page.getByLabel('HEX barva nového labelu').fill('#123456')
  await page.getByLabel('Pořadí nového labelu').fill('5')
  await page.getByRole('button', { name: 'Vytvořit label' }).click()
  await expect(page.getByText('Label je vytvořený.')).toBeVisible()

  let card = page.getByRole('article').filter({ hasText: 'Novinky' })
  await card.getByLabel('Název labelu Novinky').fill('Ze zákulisí')
  card = page.getByRole('article').filter({ hasText: 'Ze zákulisí' })
  await card.getByLabel('Slug labelu Ze zákulisí').fill('ze-zakulisi')
  await card.getByLabel('HEX barva labelu Ze zákulisí').fill('#C05A7A')
  await card.getByLabel('Pořadí labelu Ze zákulisí').fill('6')
  await card.getByRole('button', { name: 'Uložit' }).click()
  await expect(page.getByText('Label „Ze zákulisí“ je uložený.')).toBeVisible()

  const admin = await authenticateTestAdmin()
  const saved = await admin.collection('blog_labels').getFirstListItem('slug = "ze-zakulisi"')
  expect(saved).toMatchObject({ name: 'Ze zákulisí', color: '#C05A7A', sort_order: 6 })

  const used = page.getByRole('article').filter({ hasText: 'Cesty & příběhy' })
  await used.getByRole('button', { name: 'Smazat' }).click()
  let dialog = page.getByRole('dialog', { name: 'Trvale smazat label?' })
  await dialog.getByRole('button', { name: 'Trvale smazat' }).click()
  await expect(dialog.getByText(/Label se stále používá/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Zrušit' }).click()

  card = page.getByRole('article').filter({ hasText: 'Ze zákulisí' })
  await card.getByRole('button', { name: 'Smazat' }).click()
  dialog = page.getByRole('dialog', { name: 'Trvale smazat label?' })
  await dialog.getByRole('button', { name: 'Trvale smazat' }).click()
  await expect(page.getByText('Label „Ze zákulisí“ je smazaný.')).toBeVisible()
  await expect(page.getByRole('article').filter({ hasText: 'Ze zákulisí' })).toHaveCount(0)
})

test('spravuje galerii i všechny pevné sekce a admin nemá axe porušení', async ({ page }) => {
  await loginAsTestAdmin(page)

  await page.goto('/admin/gallery/new')
  await page.getByLabel('Název').fill('Nový obraz')
  await page.getByLabel('Obrázek', { exact: true }).setInputFiles(imageFile('gallery.png'))
  await expect(page.getByText(/Obrázek je připravený/)).toBeVisible()
  await page.getByLabel('Alternativní text').fill('Testovací obraz se zlatým bodem')
  await page.getByLabel('Popisek').fill('Popisek nového obrazu.')
  await page.getByLabel('Zobrazit ve veřejné galerii').check()
  await page.getByRole('button', { name: 'Uložit obrázek' }).click()
  await page.waitForURL(/\/admin\/gallery\/[a-z0-9]{15}\/edit/)

  await page.goto('/admin/gallery')
  const newItem = page.getByRole('article').filter({ hasText: 'Nový obraz' })
  await newItem.getByRole('button', { name: /Posunout .* nahoru/ }).click()
  await page.getByRole('button', { name: 'Uložit pořadí' }).click()
  await expect(page.getByText('Pořadí galerie je uložené.')).toBeVisible()

  await page.goto('/admin/web/landing')
  await page.getByLabel('Podtitulek').fill('Nový podtitulek Moniké')
  await page.getByRole('button', { name: 'Uložit úvodní texty' }).click()
  await expect(page.getByText('Texty úvodní stránky jsou uložené.')).toBeVisible()
  let cestyCard = page.getByRole('article').filter({ hasText: 'Pevný slot: cesty' })
  await cestyCard.getByLabel('Název').fill('CESTY PODLE CMS')
  await cestyCard.getByLabel('Cílový label').selectOption({ label: 'Vzpomínky' })
  await cestyCard.getByRole('button', { name: 'Uložit kartu' }).click()
  await page.goto('/')
  await expect(page.getByTestId('category-card').nth(1)).toHaveAttribute('href', '/blog?label=vzpominky')
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' }).getByRole('link', { name: 'CESTY PODLE CMS' })).toHaveAttribute('href', '/blog?label=vzpominky')
  await page.goto('/blog')
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' }).getByRole('link', { name: 'CESTY PODLE CMS' })).toHaveAttribute('href', '/blog?label=vzpominky')
  await page.goto('/admin/web/landing')
  cestyCard = page.getByRole('article').filter({ hasText: 'Pevný slot: cesty' })
  await cestyCard.getByLabel('Název').fill('CESTY & PŘÍBĚHY')
  await cestyCard.getByLabel('Cílový label').selectOption({ label: 'Cesty & příběhy' })
  await cestyCard.getByRole('button', { name: 'Uložit kartu' }).click()

  await page.goto('/admin/web/kontakt')
  await page.getByLabel('Úvodní text').fill('Napiš mi kvůli tvorbě nebo cestám.')
  await page.getByRole('button', { name: 'Uložit kontakt' }).click()
  await expect(page.getByText('Kontaktní údaje jsou uložené.')).toBeVisible()

  await page.goto('/admin/web/o-mne')
  await page.getByRole('textbox', { name: 'Příběh stránky O mně' }).fill('Nový příběh autorky Moniké.')
  await page.getByRole('button', { name: 'Uložit stránku O mně' }).click()
  await expect(page.getByText('Stránka O mně je uložená.')).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])

  await page.goto('/')
  await expect(page.getByText('Nový podtitulek Moniké')).toBeVisible()
  await page.goto('/kontakt')
  await expect(page.getByText('Napiš mi kvůli tvorbě nebo cestám.')).toBeVisible()
  await page.goto('/o-mne')
  await expect(page.getByText('Nový příběh autorky Moniké.')).toBeVisible()
})
