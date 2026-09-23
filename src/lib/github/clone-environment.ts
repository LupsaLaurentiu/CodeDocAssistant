// Preserve OS, proxy and certificate settings, but never application secrets,
// Git config injection, askpass programs or the developer's home configuration.
const INHERITED_VARIABLES = new Set([
  "PATH",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
]);

export function createCloneEnvironment(
  source: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  return {
    ...Object.fromEntries(
      Object.entries(source).filter(([key]) =>
        INHERITED_VARIABLES.has(key.toUpperCase()),
      ),
    ),
    GIT_CONFIG_NOSYSTEM: "1",
    // Git for Windows accepts NUL, not Node's extended \\.\nul device path.
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GIT_LFS_SKIP_SMUDGE: "1",
  };
}
