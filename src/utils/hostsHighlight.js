/**
 * hosts 代码高亮工具
 */

/**
 * HTML 转义
 * @param {string} text - 要转义的文本
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 高亮 hosts 代码
 * @param {string} content - hosts 内容
 * @returns {string} - 高亮后的 HTML
 */
export function highlightHosts(content) {
  const lines = content.split('\n')
  return lines.map(line => {
    if (line.trim().startsWith('#')) {
      return `<span class="token comment">${escapeHtml(line)}</span>`
    } else if (line.trim() === '') {
      return '<span class="token hosts-line">&nbsp;</span>'
    } else {
      // 尝试匹配 IP 和域名
      const ipMatch = line.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(.*)$/)
      if (ipMatch) {
        return `<span class="token ip">${ipMatch[1]}</span> <span class="token domain">${escapeHtml(ipMatch[2])}</span>`
      }
      return `<span class="token hosts-line">${escapeHtml(line)}</span>`
    }
  }).join('\n')
}
