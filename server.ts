import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/generate-skills', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    return;
  }

  const { level, context } = req.body;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
    ในฐานะผู้เชี่ยวชาญด้านการพัฒนาบุคลากร จงวิเคราะห์และแนะนำทักษะที่ควรพัฒนาสำหรับพนักงานต่อไปนี้:

    - ระดับพนักงาน: ${level}
    - งานที่ทำ / Function: ${context?.jobFunction || 'ไม่ระบุ'}
    - ปัญหาหรือ Gap ที่เจอ: ${context?.problems || 'ไม่ระบุ'}
    - ทักษะที่อยากพัฒนา: ${context?.skillsNeeded || 'ไม่ระบุ'}

    จงแนะนำทักษะทั้งหมด 10 ทักษะ แบ่งเป็น 2 กลุ่มเท่าๆ กัน คือ
    - Technical Skill จำนวน 5 ทักษะ (skill_type = "Technical")
    - Soft Skill จำนวน 5 ทักษะ (skill_type = "Soft Skill")

    พิจารณาจากระดับพนักงาน ปัญหาที่เจอ และความต้องการที่ระบุมา
    เขียนเป็นภาษาไทยทั้งหมด
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skill_name: { type: Type.STRING, description: 'ชื่อทักษะที่ควรพัฒนา (กระชับ ไม่เกิน 10 คำ)' },
              skill_type: { type: Type.STRING, description: 'ประเภทของทักษะ ต้องเป็น "Technical" หรือ "Soft Skill" เท่านั้น' },
              skill_category: { type: Type.STRING, description: 'หมวดหมู่ย่อย เช่น Data & Analytics, Communication, Leadership, Project Management' },
              description: { type: Type.STRING, description: 'อธิบายว่าทักษะนี้คืออะไร ใน 1-2 ประโยค' },
              relevance: { type: Type.STRING, description: 'ทำไมทักษะนี้จึงเหมาะกับตำแหน่งและบริบทของพนักงานคนนี้ ใน 1-2 ประโยค' },
            },
            required: ['skill_name', 'skill_type', 'skill_category', 'description', 'relevance'],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      res.status(500).json({ error: 'Empty response from AI' });
      return;
    }

    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Gemini error:', error);
    res.status(500).json({ error: 'Failed to generate skills' });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
