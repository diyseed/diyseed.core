// `?code=1-0856-0540-15-12-01-1-1` opens the "Generate from card code" dialog
// with the code filled in, so a code can be shared as a link.
export function codeFromSearch(search: string): string | null {
  const code = new URLSearchParams(search).get('code')?.trim();
  return code ? code : null;
}
