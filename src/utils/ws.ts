export function simpleSend(url: string, text: string) {
  const ws = new WebSocket(url);
  ws.onopen = () => {
    ws.send(text);
  };
}
