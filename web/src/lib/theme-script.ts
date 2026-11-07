export const THEME_STORAGE_KEY = "theme"
const KEY = THEME_STORAGE_KEY

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark"&&t!=="oled")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var c=document.documentElement.classList;c.toggle("dark",t!=="light");c.toggle("oled",t==="oled")}catch(e){}`
