export function friendlyLlmError(err: any): string {
  const raw = String(err?.message || err || '');
  const m = raw.match(/HTTP\s+(\d{3})/i);
  const code = m ? Number(m[1]) : 0;
  if (/已停止|aborted|AbortError/i.test(raw)) return '已停止生成';
  if (code === 401 || /invalid api key|unauthorized|incorrect api/i.test(raw))
    return 'API Key 无效或未授权（HTTP 401）。请到「AI 设置」核对密钥是否正确、是否过期。';
  if (code === 403) return '无权访问该模型（HTTP 403）。请确认账号已开通该模型，或更换模型名称。';
  if (code === 404) return '接口地址或模型不存在（HTTP 404）。请检查 Base URL 是否以 /v1 结尾，以及模型名称是否正确。';
  if (code === 429) return '请求过于频繁或额度不足（HTTP 429）。请稍后再试，或检查账户余额/限流。';
  if (code === 500 || code === 502 || code === 503)
    return `模型服务暂时不可用（HTTP ${code}）。请稍后重试，或切换其他提供商。`;
  if (/timeout|ETIMEDOUT|AbortSignal\.timeout|network|fetch failed|ECONNREFUSED|ENOTFOUND/i.test(raw))
    return '无法连接模型服务。请检查网络、Base URL，以及本地代理是否放行。';
  if (/JSON|未找到 JSON/i.test(raw))
    return '模型返回的内容不是合法 JSON，已中止解析。可尝试重新生成，或关闭「JSON 结构化输出」后再试。';
  if (/尚未配置|不支持 AI/i.test(raw)) return raw;
  return raw.length > 220 ? raw.slice(0, 220) + '…' : raw;
}
