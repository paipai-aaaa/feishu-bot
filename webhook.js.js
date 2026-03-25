export default async function handler(req, res) {
  // 飞书验证 URL 时用的
  if (req.body?.challenge) {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // 只处理消息事件
  const { event } = req.body;
  if (!event || event.message?.message_type !== 'text') {
    return res.status(200).send('ok');
  }

  try {
    // 获取用户消息
    const userMessage = JSON.parse(event.message.content).text;
    const chatId = event.message.chat_id;
    const messageId = event.message.message_id;

    console.log('用户说:', userMessage);

    // 调用 AI
    const aiReply = await callAI(userMessage);

    // 回复飞书
    await replyToFeishu(chatId, aiReply, messageId);

    return res.status(200).send('ok');
  } catch (err) {
    console.error('出错:', err);
    return res.status(200).send('ok');
  }
}

// 调用 SiliconFlow
async function callAI(message) {
  const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-ai/DeepSeek-V3',
      messages: [
        { role: 'system', content: '你是一个友好的AI助手，回答简洁。' },
        { role: 'user', content: message }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  
  if (!data.choices) {
    throw new Error('AI 返回错误: ' + JSON.stringify(data));
  }
  
  return data.choices[0].message.content;
}

// 回复飞书
async function replyToFeishu(chatId, content, parentId) {
  // 1. 获取 token
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET
    })
  });
  
  const tokenData = await tokenRes.json();
  
  if (!tokenData.tenant_access_token) {
    throw new Error('获取 token 失败: ' + JSON.stringify(tokenData));
  }

  // 2. 发送消息
  await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${parentId}/reply`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.tenant_access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: JSON.stringify({ text: content }),
      msg_type: 'text'
    })
  });
}