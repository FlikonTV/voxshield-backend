import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';

export const config = {
    api: { bodyParser: false },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse the uploaded file
    const form = formidable({ keepExtensions: true, maxFileSize: 50 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const file = files.file?.[0];
    const contentType = fields.content_type?.[0] || 'image';

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
}

    // Pick the right Hive endpoint
    let hiveUrl;
    if (contentType === 'audio') {
      hiveUrl = 'https://api.thehive.ai/api/v3/ai_generated_audio_recognition';
} else if (contentType === 'text') {
      hiveUrl = 'https://api.thehive.ai/api/v3/ai_generated_text_detection';
} else {
      hiveUrl = 'https://api.thehive.ai/api/v3/ai_generated_media_recognition';
}

    // Build the request to Hive
    const { default: FormData } = await import('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.filepath), {
      filename: file.originalFilename || 'upload',
      contentType: file.mimetype,
});

    // Send to Hive
    const hiveRes = await fetch(hiveUrl, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${process.env.HIVE_API_KEY}`,
        ...formData.getHeaders(),
},
      body: formData,
});

    const hiveData = await hiveRes.json();

    // Clean up temp file
    try { fs.unlinkSync(file.filepath); } catch (e) {}

    // Parse Hive's response into VoxShield format
    const output = hiveData?.status?.[0]?.response?.output || [];

    let aiScore = 0;
    let deepfakeScore = 0;
    let sourceEngine = 'none_detected';
    let sourceConf = 0;

    const skipClasses = ['ai_generated', 'not_ai_generated', 'deepfake', 'not_deepfake', 'none', 'inconclusive', 'inconclusive_video'];

    for (const group of output) {
      if (!group.classes) continue;
      for (const c of group.classes) {
        if (c.class === 'ai_generated') aiScore = c.score;
        if (c.class === 'deepfake') deepfakeScore = c.score;
        if (!skipClasses.includes(c.class) && c.score > sourceConf) {
          sourceEngine = c.class;
          sourceConf = c.score;
}
}
}

    // Calculate authenticity (higher = more authentic)
    const forensic = Math.round((1 - aiScore) * 100);
    const deepfakeAuth = Math.round((1 - deepfakeScore) * 100);
    const score = Math.round(forensic * 0.6 + deepfakeAuth * 0.4);

    let classification;
    if (score >= 85) classification = 'AUTHENTIC';
    else if (score >= 65) classification = 'LIKELY_AUTHENTIC';
    else if (score >= 40) classification = 'SUSPICIOUS';
    else classification = 'LIKELY_SYNTHETIC';

    return res.status(200).json({
      success: true,
      authenticityScore: score,
      classification,
      aiGeneratedProbability: Math.round(aiScore * 100),
      deepfakeProbability: Math.round(deepfakeScore * 100),
      likelySource: sourceConf > 0.1 ? sourceEngine : 'none_detected',
      sourceConfidence: Math.round(sourceConf * 100),
      contentType,
});

} catch (error) {
    console.error('Hive error:', error);
    return res.status(500).json({ error: 'Detection failed', message: error.message });
}
}
