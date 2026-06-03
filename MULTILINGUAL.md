# Multilingual Setup Documentation

This project now supports **Portuguese (PT)**, **English (EN)**, and **Spanish (ES)**.

## Architecture

### Key Files

- **Frontend i18n Configuration**: `frontend/src/i18n/index.js`
  - Initializes vue-i18n
  - Auto-detects browser language
  - Falls back to Portuguese if browser language not supported
  - Stores language preference in localStorage

- **Translation Files**: `frontend/src/i18n/locales/`
  - `pt.json` - Portuguese translations
  - `en.json` - English translations
  - `es.json` - Spanish translations

- **Language Selector Component**: `frontend/src/components/LanguageSelector.vue`
  - Dropdown to switch between languages
  - Automatically saves preference to localStorage
  - Updates app UI in real-time

- **App Integration**: `frontend/src/App.vue`
  - Uses `useI18n()` composable from vue-i18n
  - Uses `$t()` for translations throughout the template
  - Expense types are computed reactively to update with language changes

### Translation Keys Structure

```json
{
  "app": {
    "title": "Application name",
    "health": "Health check text"
  },
  "tabs": {
    "expenses": "Tab label",
    "report": "Tab label"
  },
  "form": {
    "addExpense": "Form heading",
    "origem": "Form field label",
    ...
  },
  "types": {
    "1": "Expense type names",
    ...
  },
  "errors": {
    "genericError": "Error message"
  }
}
```

## How It Works

### Language Detection & Storage

1. On first visit, the app checks `localStorage` for a saved language preference
2. If not found, it detects the browser's language from `navigator.language`
3. If browser language is not supported (PT/EN/ES), defaults to Portuguese
4. When user changes language via the selector, it:
   - Updates the app's locale reactively
   - Saves the preference to localStorage
   - Persists across page reloads

### Adding New Translations

1. Add keys to all three translation files: `pt.json`, `en.json`, `es.json`
2. Use `$t('key.path')` in templates or `t('key.path')` in scripts
3. For dynamic content, use the `t()` function in computed properties or methods

### Supported Languages

| Code | Language | Flag |
|------|----------|------|
| `pt` | Português | 🇧🇷 |
| `en` | English | 🇬🇧 |
| `es` | Español | 🇪🇸 |

## Development Notes

- Vue-i18n version 10.x is installed (note: v11 is newer but kept v10 for stability)
- Language selector appears in the top-right of the header
- Expense types update automatically when language changes
- Date formatting respects the current locale
- Some UI strings that weren't in translation files use ternary operators with `locale` for now - consider adding these to translation files as needed

## Future Enhancements

- [ ] Add backend API translation support for error messages
- [ ] Add translated currency symbols (currently always R$)
- [ ] Add more languages
- [ ] Create a user preferences endpoint to save language in the database
- [ ] Add RTL language support if needed
- [ ] Create a custom hook for common translated strings

## Testing

To test the multilingual setup:

1. Start the development server: `npm run dev`
2. Open the app in your browser
3. Look for the language selector in the top-right of the header
4. Switch between languages and verify:
   - All UI text updates
   - Language preference persists on reload
   - Expense types list updates
   - Date formatting changes appropriately
