const minimumChoice = /^(reject( all)?( (optional|non-essential) cookies| cookies)?|decline( all)?( optional cookies| cookies)?|deny( all)?|only (accept )?(necessary|essential)( cookies)?|accept (only )?(necessary|essential)( cookies)?( only)?|necessary( cookies)? only|essential( cookies)? only|continue without accepting|continue with( only)? (necessary|essential) cookies( only)?|alle( cookies)? ablehnen|ablehnen|nur (notwendige|erforderliche|essenzielle)( cookies)?( akzeptieren| zulassen)?|nur technisch notwendige cookies|tout refuser|refuser|uniquement nécessaires|rechazar( todas)?|solo necesarias)$/i;
const settingsChoice = /^(cookie settings|manage( cookie)? (preferences|settings|cookies)|customi[sz]e( cookies)?|preferences|einstellungen|cookie-einstellungen|einstellungen anpassen|anpassen|auswahl anpassen|paramétrer|configurar)$/i;
const saveChoice = /^(save( my)? (preferences|settings|selection)|confirm (my )?(choices|selection)|accept selection|auswahl (bestätigen|speichern)|einstellungen speichern|speichern|enregistrer( mes choix)?)$/i;
const cookieWords = /cookies?|tracking|consent|einwilligung/i;
const requiredWords = /necessary|essential|required|notwendig|erforderlich|essenziell|nécessaire/i;
const optionalWords = /analytics|analytical|statistics|marketing|advertising|personalization|personalisation|preferences|functional|performance|tracking|statistik|analyse|werbung|präferenzen|funktional|personalisier/i;
const containerSelector = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="onetrust" i], [id*="didomi" i]';

async function panels(page) {
  const results = [];
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame() && !await frame.frameElement().then(el=>el.isVisible()).catch(()=>false)) continue;
    for (const panel of await frame.locator(containerSelector).all()) {
      if (await panel.isVisible() && cookieWords.test(await panel.innerText())) results.push(panel);
    }
  }
  return results;
}
async function button(panel, name) {
  const matches = panel.getByRole('button', {name}).or(panel.getByRole('link', {name}));
  const visible = [];
  for (const match of await matches.all()) if (await match.isVisible() && await match.isEnabled()) visible.push(match);
  return visible.length === 1 ? visible[0] : null;
}

// Only act inside an identified cookie panel, using an explicit minimum-consent label.
export async function dismissOptionalCookies(page, {beforeAction = async()=>{}, afterAction = async()=>{}} = {}) {
  let changed = false;
  let openedSettings = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const visiblePanels = await panels(page);
    if (!visiblePanels.length) return changed;
    let acted = false;
    for (const panel of visiblePanels) {
      const minimum = await button(panel, minimumChoice);
      if (minimum) {
        await beforeAction('Dismissing optional cookies…');
        await minimum.click({timeout:3000});
        changed = true; acted = true;
        await afterAction('Optional cookies declined; necessary cookies only.');
        // Wait for the consent interface to close, including asynchronously loaded panels.
        await panel.waitFor({state:'hidden',timeout:1200}).catch(()=>{});
        break;
      }
    }
    if (acted) continue;
    if (!openedSettings) {
      for (const panel of visiblePanels) {
        const settings = await button(panel, settingsChoice);
        if (!settings) continue;
        await beforeAction('Opening cookie preferences…');
        await settings.click({timeout:3000});
        openedSettings = true; acted = true;
        break;
      }
      if (acted) continue;
    }
    if (openedSettings) {
      for (const panel of visiblePanels) {
        const save = await button(panel, saveChoice);
        if (!save) continue;
        const toggles = panel.getByRole('checkbox').or(panel.getByRole('switch'));
        const controls = await toggles.all();
        if (!controls.length) continue;
        let uncertain = false;
        for (const control of controls) {
          if (!await control.isVisible()) continue;
          const name = await control.evaluate(el => {
            const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id=>document.getElementById(id)?.textContent || '').join(' ');
            return el.getAttribute('aria-label') || labelled.trim() || [...(el.labels || [])].map(label=>label.textContent).join(' ') || el.textContent || '';
          });
          if (requiredWords.test(name)) continue;
          if (!optionalWords.test(name)) {uncertain = true; break;}
          if (await control.isChecked()) {
            if (!await control.isEnabled()) {uncertain = true; break;}
            await beforeAction('Turning off optional cookies…');
            await control.setChecked(false,{timeout:2000});
          }
        }
        if (uncertain) continue;
        await beforeAction('Saving necessary-only cookie preferences…');
        await save.click({timeout:3000});
        changed = true; acted = true;
        await afterAction('Optional cookies disabled; necessary cookies only.');
        await panel.waitFor({state:'hidden',timeout:1200}).catch(()=>{});
        break;
      }
    }
    if (!acted) break;
  }
  if ((await panels(page)).length) throw new Error('The cookie panel has no clear necessary-only option. Review the choices on the booking site; optional cookies have not been accepted.');
  return changed;
}
