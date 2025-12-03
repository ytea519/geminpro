/**
 * mock-api.js
 * 模拟图片生成API服务器，用于测试和演示
 */

import express from 'express';
import { randomBytes } from 'crypto';

const app = express();
const port = 8000;

app.use(express.json());

// 生成简单的SVG图片作为响应
function generateMockImage(prompt) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const seed = randomBytes(4).toString('hex');
    
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
        <linearGradient id="grad${seed}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FFF;stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#grad${seed})"/>
    <circle cx="256" cy="256" r="100" fill="${color}" opacity="0.8"/>
    <text x="256" y="280" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">
        AI Generated
    </text>
    <text x="256" y="300" text-anchor="middle" fill="white" font-family="Arial" font-size="12">
        ${prompt.substring(0, 20)}${prompt.length > 20 ? '...' : ''}
    </text>
</svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// OpenAI兼容的聊天完成端点
app.post('/v1/chat/completions', (req, res) => {
    const { messages, model } = req.body;
    
    console.log(`[Mock API] 收到生成请求:`, {
        model,
        messageCount: messages?.length,
        lastMessage: messages?.[messages.length - 1]?.content?.substring(0, 100) + '...'
    });

    const userPrompt = messages?.[messages.length - 1]?.content || '';
    
    // 模拟处理延迟
    setTimeout(() => {
        const mockImage = generateMockImage(userPrompt);
        
        const response = {
            id: `chatcmpl-${randomBytes(8).toString('hex')}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model || 'banana-pro',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: `![Generated Image](${mockImage})`
                },
                finish_reason: 'stop'
            }],
            usage: {
                prompt_tokens: 50,
                completion_tokens: 10,
                total_tokens: 60
            }
        };

        res.json(response);
    }, 2000 + Math.random() * 3000); // 2-5秒随机延迟
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Mock API is running' });
});

app.listen(port, () => {
    console.log('==========================================');
    console.log('🤖 Mock API 服务器已启动');
    console.log('==========================================');
    console.log(`📡 服务地址: http://localhost:${port}`);
    console.log('🎨 模拟图片生成功能');
    console.log('==========================================');
});