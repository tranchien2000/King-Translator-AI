# King Translator AI Proxy

Local proxy server cho King Translator - route requests tới providers miễn phí/rẻ.

## Providers hỗ trợ

### 1. **9router** (Recommended ⭐)
- GPT-4o-mini FREE
- Claude 3.5 Sonnet, GPT-4o (rẻ)
- Không cần VPN, stable
- Đăng ký: https://9router.com

### 2. **OpenRouter**
- Free tier: nhiều models miễn phí
- Models: `google/gemma-2-9b-it:free`, `meta-llama/llama-3.1-8b-instruct:free`
- Đăng ký: https://openrouter.ai

### 3. **Groq**
- Miễn phí, SIÊU NHANH (inference tốc độ cao)
- Models: `llama-3.3-70b-versatile`, `llama-3.1-70b-versatile`
- Đăng ký: https://console.groq.com

### 4. **Together AI**
- Free tier 5$/tháng
- Hỗ trợ vision models
- Đăng ký: https://api.together.xyz

## Cài đặt

```bash
cd local-ai-proxy
npm install
```

## Config

1. Copy `.env.example` → `.env`
2. Điền API keys:

```env
OPENROUTER_KEY=sk-or-v1-xxx
GROQ_KEY=gsk_xxx
TOGETHER_KEY=xxx
```

## Chạy server

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

Server chạy tại: `http://localhost:3000`

## API Endpoints

### POST `/v1/translate`

Dịch text thường.

**Request:**
```json
{
  "text": "Hello world",
  "provider": "openrouter",
  "model": "google/gemma-2-9b-it:free",
  "temperature": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "text": "Xin chào thế giới",
  "provider": "openrouter",
  "model": "google/gemma-2-9b-it:free"
}
```

### POST `/v1/translate-image`

Dịch text trong ảnh (OCR).

**Request:**
```json
{
  "text": "Translate this image to Vietnamese",
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "provider": "together"
}
```

### GET `/health`

Health check.

## Tích hợp vào script

Thêm provider mới vào [config.js](../src2/config/config.js):

```javascript
localProxy: {
  baseUrl: "http://localhost:3000/v1/translate",
  models: {
    fast: "openrouter-free",
    balance: "groq-fast"
  },
  headers: {
    "Content-Type": "application/json"
  },
  createRequestBody: (content, model = "openrouter-free") => ({
    text: content,
    provider: model.split('-')[0],
    model: model === "openrouter-free" ? "google/gemma-2-9b-it:free" : null
  }),
  responseParser: (response) => {
    if (response?.text) {
      return response.text;
    }
    throw new Error("Không thể đọc kết quả từ Local Proxy");
  }
}
```

## Cost comparison

| Provider | Cost | Speed | Quality |
|----------|------|-------|---------|
| OpenRouter free | $0 | Medium | Good |
| Groq | $0 | ⚡ Very fast | Good |
| Together AI | $0.20/1M tokens | Fast | Very good |
| Gemini API | $0-$7/1M | Fast | Excellent |

## Tips

1. **Groq cho dịch nhanh** - gần như instant
2. **OpenRouter free** - backup khi rate limit
3. **Together AI** - dùng cho OCR/vision
4. **Load balancing** - rotate giữa các providers

## Troubleshooting

### CORS errors
Server đã enable CORS. Nếu vẫn lỗi, check browser console.

### Rate limits
- Groq: 30 req/min
- OpenRouter: depends on model
- Together: 60 req/min (free tier)

Implement retry logic trong script.

### Connection refused
```bash
# Check server running
curl http://localhost:3000/health
```
