import type { GitHubRepositoryReference } from "@/types/repository";

const GITHUB_HOSTNAME = "github.com";
const VALID_SEGMENT = /^[A-Za-z0-9_.-]+$/;

export function validateRepositoryUrl(
  value: string,
): GitHubRepositoryReference {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Repository URL must be a valid URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== GITHUB_HOSTNAME ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Only HTTPS GitHub repository URLs are supported.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) {
    throw new Error(
      "Repository URL must have the form https://github.com/owner/name.",
    );
  }

  const [owner, rawName] = segments;
  const name = rawName.endsWith(".git") ? rawName.slice(0, -4) : rawName;

  if (!VALID_SEGMENT.test(owner) || !VALID_SEGMENT.test(name)) {
    throw new Error(
      "Repository owner or name contains unsupported characters.",
    );
  }

  const normalizedUrl = `https://${GITHUB_HOSTNAME}/${owner}/${name}`;

  return {
    owner,
    name,
    url: normalizedUrl,
    cloneUrl: `${normalizedUrl}.git`,
  };
}
