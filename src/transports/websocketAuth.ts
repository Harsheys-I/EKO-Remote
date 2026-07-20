export function websocketAuthProtocol(token: string) {
  const bytes = new TextEncoder().encode(token);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `eko.token.${window.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
}

export function websocketUrl(baseUrl: string, path: string) {
  return `${baseUrl.trim().replace(/\/$/, "").replace(/^http/, "ws")}${path}`;
}
