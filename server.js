/**
 * server.js
 * Banana Pro AI 生图平台 - 后端服务
 * 支持多图上传的 ES6 模块化版本
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';

// ============================================
// 配置初始化模块
// ============================================
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parsePositiveInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const CONFIG = {
    port: process.env.PORT || 3000,
    apiKey: process.env.OPENAI_API_KEY || 'sk-123456',
    apiUrl: process.env.OPENAI_API_URL || 'http://127.0.0.1:8000/v1/chat/completions',
    sitePassword: process.env.SITE_PASSWORD || '123456',
    modelName: process.env.MODEL_NAME || 'banana-pro',
    maxImages: 16,
    maxPublicGalleryItems: parsePositiveInt(process.env.PUBLIC_GALLERY_LIMIT, 80)
};

// 调试输出环境变量
console.log(`[DEBUG] 环境变量 OPENAI_API_URL:`, process.env.OPENAI_API_URL);
console.log(`[DEBUG] 最终 CONFIG.apiUrl:`, CONFIG.apiUrl);

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_GALLERY_FILE = path.join(DATA_DIR, 'public-gallery.json');

// ============================================
// Express 应用初始化
// ============================================
const app = express();

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use(cookieParser());
app.use(express.static(__dirname));

// ============================================
// 认证中间件
// ============================================
const authMiddleware = (req, res, next) => {
    const token = req.cookies.auth_token;
    if (token === CONFIG.sitePassword) {
        next();
    } else {
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: '请先登录'
        });
    }
};

// ============================================
// 图片数据解析模块
// ============================================
const ImageParser = {
    /**
     * 从 assistant content 中提取 base64 图片数据
     * 格式: ![Generated Image](data:image/png;base64,xxxxx)
     */
    extractBase64FromMarkdown(content) {
        if (!content || typeof content !== 'string') {
            return null;
        }

        // 匹配 Markdown 图片格式
        const markdownPattern = /!\[.*?\]\((data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+)\)/g;
        const matches = content.match(markdownPattern);

        if (matches && matches.length > 0) {
            const dataUrlMatch = matches[0].match(/\((data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+)\)/);
            if (dataUrlMatch && dataUrlMatch[1]) {
                return dataUrlMatch[1];
            }
        }

        // 备用：直接匹配 data:image 格式
        const directPattern = /(data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+)/;
        const directMatch = content.match(directPattern);
        if (directMatch && directMatch[1]) {
            return directMatch[1];
        }

        return null;
    },

    isValidBase64Image(base64Data) {
        if (!base64Data) return false;
        return base64Data.startsWith('data:image/');
    }
};

// ============================================
// 消息构建模块
// ============================================
const MessageBuilder = {
    /**
     * 构建包含图片的 OpenAI 格式消息
     * @param {string} prompt - 文本提示词
     * @param {Array<string>} images - base64 图片数组
     * @returns {Array} - OpenAI messages 格式
     */
    buildMessages(prompt, images = []) {
        // 如果没有图片，返回纯文本消息
        if (!images || images.length === 0) {
            return [
                {
                    role: 'user',
                    content: prompt
                }
            ];
        }

        // 构��多模态消息内容
        const contentParts = [];

        // 添加所有图片
        images.forEach((imageData, index) => {
            // 提取 base64 数据和 MIME 类型
            const matches = imageData.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (matches) {
                contentParts.push({
                    type: 'image_url',
                    image_url: {
                        url: imageData
                    }
                });
            }
        });

        // 添加文本提示词
        contentParts.push({
            type: 'text',
            text: prompt
        });

        return [
            {
                role: 'user',
                content: contentParts
            }
        ];
    }
};

// ============================================
// API 请求模块
// ============================================
const APIService = {
    /**
     * 调用生图 API
     * @param {string} prompt - 用户提示词
     * @param {Array<string>} images - 上传的图片数组
     */
    async generateImage(prompt, images = []) {
        const messages = MessageBuilder.buildMessages(prompt, images);

        const payload = {
            model: CONFIG.modelName,
            messages: messages
        };

        console.log(`[${new Date().toISOString()}] 请求模型: ${CONFIG.modelName}`);
        console.log(`[${new Date().toISOString()}] 提示词: ${prompt.substring(0, 100)}...`);
        console.log(`[${new Date().toISOString()}] 携带图片数量: ${images.length}`);

        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
        }

        return await response.json();
    },

    /**
     * 从响应中提取图片
     */
    extractImageFromResponse(data) {
        console.log(`[${new Date().toISOString()}] API响应类型:`, typeof data);
        console.log(`[${new Date().toISOString()}] API响应结构:`, Object.keys(data || {}));

        // 检查错误响应
        if (data.error) {
            throw new Error(`API返回错误: ${data.error}`);
        }

        if (data.choices && data.choices[0] && data.choices[0].message) {
            const content = data.choices[0].message.content;

            console.log(`[${new Date().toISOString()}] 收到响应内容长度: ${content?.length || 0}`);
            console.log(`[${new Date().toISOString()}] 响应内容预览:`, content?.substring(0, 200) + (content?.length > 200 ? '...' : ''));

            const imageData = ImageParser.extractBase64FromMarkdown(content);

            if (imageData && ImageParser.isValidBase64Image(imageData)) {
                console.log(`[${new Date().toISOString()}] 成功提取图片数据，长度: ${imageData.length}`);
                return imageData;
            } else {
                console.log(`[${new Date().toISOString()}] 未能从内容中提取有效图片数据`);
            }
        }

        // 检查 DALL-E 格式
        if (data.data && data.data[0]) {
            if (data.data[0].b64_json) {
                console.log(`[${new Date().toISOString()}] 使用 DALL-E b64_json 格式`);
                return `data:image/png;base64,${data.data[0].b64_json}`;
            }
            if (data.data[0].url) {
                console.log(`[${new Date().toISOString()}] 使用 DALL-E URL 格式`);
                return data.data[0].url;
            }
        }

        // 如果到这里还没有找到图片，输出完整的响应用于调试
        console.log(`[${new Date().toISOString()}] 完整API响应:`, JSON.stringify(data, null, 2));
        throw new Error('无法从 API 响应中提取图片数据。请检查API配置和模型响应格式。');
    }
};

// ============================================
// 公共画廊存储模块
// ============================================
const generateId = () => {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return crypto.randomBytes(16).toString('hex');
};

const generateDeleteToken = () => crypto.randomBytes(24).toString('hex');

const PublicGalleryStore = {
    async ensureFile() {
        await fs.mkdir(DATA_DIR, { recursive: true });
        try {
            await fs.access(PUBLIC_GALLERY_FILE);
        } catch {
            await fs.writeFile(PUBLIC_GALLERY_FILE, '[]', 'utf-8');
        }
    },

    async readData() {
        await this.ensureFile();
        try {
            const raw = await fs.readFile(PUBLIC_GALLERY_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error(`[${new Date().toISOString()}] 读取公共画廊数据失败:`, error);
            return [];
        }
    },

    async writeData(items) {
        await this.ensureFile();
        await fs.writeFile(PUBLIC_GALLERY_FILE, JSON.stringify(items, null, 2), 'utf-8');
    },

    async getAll() {
        return await this.readData();
    },

    async add(entry) {
        const items = await this.readData();
        items.unshift(entry);
        if (items.length > CONFIG.maxPublicGalleryItems) {
            items.splice(CONFIG.maxPublicGalleryItems);
        }
        await this.writeData(items);
        return entry;
    },

    async remove(id, token) {
        const items = await this.readData();
        const targetIndex = items.findIndex(item => item.id === id);

        if (targetIndex === -1) {
            return { found: false };
        }

        if (items[targetIndex].deleteToken !== token) {
            return { found: true, authorized: false };
        }

        items.splice(targetIndex, 1);
        await this.writeData(items);
        return { found: true, authorized: true };
    }
};

// ============================================
// 路由
// ============================================

// 登录
app.post('/api/login', (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({
            success: false,
            message: '请输入密码'
        });
    }

    if (password === CONFIG.sitePassword) {
        res.cookie('auth_token', password, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'strict'
        });

        console.log(`[${new Date().toISOString()}] 用户登录成功`);

        res.json({
            success: true,
            message: '登录成功'
        });
    } else {
        res.status(403).json({
            success: false,
            message: '密码错误'
        });
    }
});

// 验证状态
app.get('/api/check-auth', (req, res) => {
    const token = req.cookies.auth_token;
    res.json({ authenticated: token === CONFIG.sitePassword });
});

// 生图接口（支持多图上传）
app.post('/api/generate', authMiddleware, async (req, res) => {
    const { prompt, images } = req.body;

    // 验证提示词
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({
            success: false,
            message: '请提供有效的提示词'
        });
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
        return res.status(400).json({
            success: false,
            message: '提示词不能为空'
        });
    }

    if (trimmedPrompt.length > 32000) {
        return res.status(400).json({
            success: false,
            message: '提示词过长，请限制在 32000 字符以内'
        });
    }

    // 验证图片数量
    const uploadedImages = images || [];
    if (uploadedImages.length > CONFIG.maxImages) {
        return res.status(400).json({
            success: false,
            message: `最多只能上传 ${CONFIG.maxImages} 张图片`
        });
    }

    // 验证图片格式
    for (let i = 0; i < uploadedImages.length; i++) {
        if (!ImageParser.isValidBase64Image(uploadedImages[i])) {
            return res.status(400).json({
                success: false,
                message: `第 ${i + 1} 张图片格式无效`
            });
        }
    }

    try {
        console.log(`[${new Date().toISOString()}] 开始生成图片...`);
        console.log(`[${new Date().toISOString()}] API地址: ${CONFIG.apiUrl}`);
        console.log(`[${new Date().toISOString()}] API密钥: ${CONFIG.apiKey.substring(0, 10)}...`);

        const apiResponse = await APIService.generateImage(trimmedPrompt, uploadedImages);
        const imageData = APIService.extractImageFromResponse(apiResponse);

        console.log(`[${new Date().toISOString()}] 图片生成成功`);

        res.json({
            success: true,
            image: imageData,
            prompt: trimmedPrompt,
            inputImages: uploadedImages, // 返回用户上传的图片，用于历史记录
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] 生成失败:`, error.message);
        console.error(`[${new Date().toISOString()}] 错误堆栈:`, error.stack);

        // 根据错误类型提供更具体的错误信息
        let errorMessage = error.message;
        if (error.message.includes('API返回错误: 未授权') || error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMessage = 'API认证失败，请检查API密钥配置';
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
            errorMessage = '无法连接到API服务器，请检查网络连接和API地址配置';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'API请求超时，请稍后重试';
        }

        res.status(500).json({
            success: false,
            message: errorMessage || '图片生成失败，请稍后重试'
        });
    }
});

// 公共画廊 - 获取列表
app.get('/api/public-gallery', async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] 开始加载公共画廊...`);
        const items = await PublicGalleryStore.getAll();
        const sanitized = items.map(({ deleteToken, ...rest }) => rest);
        
        console.log(`[${new Date().toISOString()}] 公共画廊加载完成，项目数: ${sanitized.length}`);
        
        res.json({
            success: true,
            items: sanitized
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 加载公共画廊失败:`, error);
        console.error(`[${new Date().toISOString()}] 错误详情:`, error.stack);
        res.status(500).json({
            success: false,
            message: '无法加载公共画廊，请稍后重试'
        });
    }
});

// 公共画廊 - 发布作品
app.post('/api/public-gallery', authMiddleware, async (req, res) => {
    const { prompt, image, inputImages } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
            success: false,
            message: '请输入有效的提示词'
        });
    }

    if (!image || typeof image !== 'string' || !ImageParser.isValidBase64Image(image)) {
        return res.status(400).json({
            success: false,
            message: '请提供有效的图片数据'
        });
    }

    const sanitizedRefs = Array.isArray(inputImages)
        ? inputImages
            .filter(img => typeof img === 'string' && ImageParser.isValidBase64Image(img))
            .slice(0, CONFIG.maxImages)
        : [];

    const entry = {
        id: generateId(),
        prompt: prompt.trim(),
        image,
        inputImages: sanitizedRefs,
        timestamp: new Date().toISOString(),
        deleteToken: generateDeleteToken()
    };

    try {
        await PublicGalleryStore.add(entry);
        const { deleteToken, ...publicItem } = entry;
        res.json({
            success: true,
            item: publicItem,
            deleteToken
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 发布公共画廊失败:`, error);
        res.status(500).json({
            success: false,
            message: '发布失败，请稍后再试'
        });
    }
});

// 公共画廊 - 删除作品（允许任何人删除）
app.delete('/api/public-gallery/:id', async (req, res) => {
    const id = req.params.id;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({
            success: false,
            message: '无效的作品 ID'
        });
    }

    try {
        const items = await PublicGalleryStore.readData();
        const targetIndex = items.findIndex(item => item.id === id);

        if (targetIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '作品不存在或已被删除'
            });
        }

        items.splice(targetIndex, 1);
        await PublicGalleryStore.writeData(items);

        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 删除公共画廊失败:`, error);
        res.status(500).json({
            success: false,
            message: '删除失败，请稍后再试'
        });
    }
});

// 登出
app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: '已退出登录' });
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        model: CONFIG.modelName,
        maxImages: CONFIG.maxImages
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] 服务器错误:`, err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.use((req, res) => {
    res.status(404).json({ success: false, message: '接口不存在' });
});

// ============================================
// 启动服务器
// ============================================
app.listen(CONFIG.port, () => {
    console.log('==========================================');
    console.log('🍌 Banana Pro AI Studio 服务已启动');
    console.log('==========================================');
    console.log(`📡 服务地址: http://localhost:${CONFIG.port}`);
    console.log(`🤖 使用模型: ${CONFIG.modelName}`);
    console.log(`🖼️  最大图片: ${CONFIG.maxImages} 张`);
    console.log(`🔗 API 地址: ${CONFIG.apiUrl}`);
    console.log('==========================================');
});

export default app;
