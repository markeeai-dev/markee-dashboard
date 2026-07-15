'use strict';
// Mock 9Router instance — mô phỏng 1 container/instance/seat riêng (Q9, v16).
// Không phải 9Router thật — chỉ giả lập đủ hành vi để test logic routing/streaming
// của Gateway Adapter TRƯỚC KHI có 9Router thật + Claude Team account thật.
//
// Chạy: SEAT_NAME=seat_claude_thanh PORT=20128 node server.js

const http = require('http');

const SEAT_NAME = process.env.SEAT_NAME || 'unknown_seat';
const PORT = parseInt(process.env.PORT || '20128', 10);

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let parsed = {};
    try {
      parsed = body ? JSON.parse(body) : {};
    } catch {
      // ignore, treat as non-JSON body
    }

    console.log(
      `[mock-router:${SEAT_NAME}] ${req.method} ${req.url} stream=${!!parsed.stream}`
    );

    if (parsed.stream) {
      // Giả lập streaming SSE — vài chunk rời rạc, có delay, để test Adapter
      // proxy đúng thứ tự, không gộp/không vỡ chunk.
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Mock-Seat': SEAT_NAME,
      });

      const chunks = [
        { type: 'message_start', seat: SEAT_NAME },
        { type: 'content_block_delta', text: 'Xin chao ' },
        { type: 'content_block_delta', text: 'tu ' + SEAT_NAME },
        { type: 'message_stop' },
      ];

      let i = 0;
      const sendNext = () => {
        if (i >= chunks.length) {
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        res.write(`data: ${JSON.stringify(chunks[i])}\n\n`);
        i += 1;
        setTimeout(sendNext, 15);
      };
      sendNext();
      return;
    }

    // Non-stream: trả JSON thường, kèm rõ seat đã xử lý request này —
    // test harness dùng field này để xác nhận routing đúng seat.
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Mock-Seat': SEAT_NAME });
    res.end(
      JSON.stringify({
        seat: SEAT_NAME,
        model: parsed.model || 'unknown-model',
        echo: parsed,
        usage: { input_tokens: 12, output_tokens: 8 },
      })
    );
  });
});

server.listen(PORT, () => {
  console.log(`[mock-router:${SEAT_NAME}] listening on :${PORT}`);
});
