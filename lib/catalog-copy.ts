/** Refreshes older seeded public copy without changing internal availability or commerce flags. */
export function catalogDisplayText(text:string):string {
 return text
  .replaceAll('Цей запис створений для перевірки роботи платформи й не представляє реальний клуб. Адреса, години та доступність не підтверджені.','')
  .replaceAll('Демонстраційний профіль.','')
  .replaceAll('Ілюстративний профіль, що очікує підключення.','')
  .replaceAll('Простір очікує підключення. Адреса, години та доступність уточнюються перед відкриттям запису.','')
  .replaceAll('Ім’я та стаж є прикладом, професійні кваліфікації не підтверджені.','')
  .replaceAll('Демонстраційні дані; освіта не підтверджена','Освіта уточнюється перед підключенням')
  .replaceAll('Демонстраційна концепція','Каталожна концепція')
  .replaceAll('Демонстраційна сауна','')
  .replace(/\bDEMO\b/gi,'')
  .replace(/Демонстраційний/g,'Непідтверджений').replace(/демонстраційний/g,'непідтверджений')
  .replace(/Демонстраційна/g,'Непідтверджена').replace(/демонстраційна/g,'непідтверджена')
  .replace(/Демонстраційні/g,'Непідтверджені').replace(/демонстраційні/g,'непідтверджені')
  .replace(/демонстраційних/g,'непідтверджених').replace(/демонстраційного/g,'непідтвердженого').trim();
}
export function catalogDisplayRecord<T extends object>(entry:T):T {
 const copy={...entry} as T & Record<string,unknown>;
 for(const field of ['name','description','education','coordinateNote'])if(typeof copy[field]==='string')(copy as Record<string,unknown>)[field]=catalogDisplayText(copy[field] as string);
 for(const field of ['tags','services','schedule'])if(Array.isArray(copy[field]))(copy as Record<string,unknown>)[field]=(copy[field] as unknown[]).map(text=>typeof text==='string'?catalogDisplayText(text):text).filter(Boolean);
 return copy;
}
