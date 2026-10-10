# Quick Start - King Translator Local Proxy

Setup server local trong 5 phút.

## Bước 1: Cài đặt

```bash
cd local-ai-proxy
npm install
```

## Bước 2: Lấy API Keys (Miễn phí)

### Option 1: 9router (Recommended ⭐)
1. Vào https://9router.com
2. Sign up với email/Google
3. Dashboard → API Keys → Create
4. Copy key
5. **Ưu điểm**: GPT-4o-mini FREE, Claude 3.5 Sonnet, không cần VPN

### Option 2: OpenRouter (Nhiều models free)
1. Vào https://openrouter.ai
2. Sign up với Google/GitHub
3. Vào "Keys" → "Create Key"
4. Copy key (dạng: `sk-or-v1-...`)

### Option 3: Groq (Siêu nhanh - Free)
1. Vào https://console.groq.com
2. Sign up
3. Vào "API Keys" → "Create API Key"
4. Copy key (dạng: `gsk_...`)

### Option 4: Together AI (Vision support)
1. Vào https://api.together.xyz
2. Sign up
3. Settings → API Keys
4. Copy key

## Bước 3: Config

Tạo file `.env`:

```bash
cp .env.example .env
```

Edit `.env` và điền key:

```env
# Chọn 1 trong 4 (hoặc cả 4 để backup)
NINEROUTER_KEY=xxxxx
OPENROUTER_KEY=sk-or-v1-xxxxx
GROQ_KEY=gsk_xxxxx
TOGETHER_KEY=xxxxx

PORT=3000
```

## Bước 4: Chạy server

```bash
npm start
```

Thấy dòng này là OK:
```
AI Proxy server running on http://localhost:3000
```

## Bước 5: Test

```bash
curl http://localhost:3000/health
```

Response:
```json
{"status":"ok","providers":["openrouter","groq","together"]}
```

## Bước 6: Cấu hình script

1. Mở userscript trong browser
2. Click icon King Translator → Settings
3. Chọn **API PROVIDER** → **Local Proxy 🚀**
4. Kiểm tra endpoint: `http://localhost:3000`
5. Chọn provider: **9router (Recommended)** / **OpenRouter (Free)** / **Groq (Fast)**
6. Chọn model: **GPT-4o-mini (Free)** hoặc model khác
7. Save

## Test dịch

1. Bôi đen text bất kỳ
2. Nhấn nút dịch hoặc Alt+T
3. Nếu thành công → Done! 🎉

## Troubleshooting

### "Connection refused"
```bash
# Check server có chạy không
netstat -ano | findstr :3000

# Restart server
npm start
```

### "Provider error"
- Check API key trong `.env` đúng chưa
- Check key còn hạn chưa (vào dashboard provider)

### CORS error
- Server đã enable CORS
- Nếu vẫn lỗi, thử clear browser cache

## Cost

| Provider | Free tier | Rate limit | Note |
|----------|-----------|------------|------|
| 9router | GPT-4o-mini FREE | Good | ⭐ Best cho production |
| OpenRouter | Unlimited (free models) | Varies | Nhiều models backup |
| Groq | Unlimited | 30 req/min | Nhanh nhất |
| Together AI | $5/month credit | 60 req/min | Có vision |

## Tips

- **9router**: Best choice - GPT-4o-mini free quality cao, stable
- **Groq**: Nhanh nhất cho dịch text thường
- **OpenRouter**: Nhiều models backup khi rate limit
- **Together AI**: Dùng cho OCR/dịch ảnh

## Next steps

- Deploy lên cloud (Railway/Render) để access từ xa
- Thêm caching layer để tiết kiệm requests
- Load balancing giữa nhiều providers
