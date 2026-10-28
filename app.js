const state = {
  payload: null,
  year: 'all',
  quality: 'all',
  field: 'all',
  sort: 'year-asc',
  query: '',
  page: 1,
  pageSize: 10,
}

const qualityClassMap = {
  高: 'high',
  中: 'mid',
  需复核: 'review',
}

const qualityLabelMap = {
  高: '高质量',
  中: '中质量',
  需复核: '需复核',
}

const qualityColorMap = {
  高: '#10b981',
  中: '#3b82f6',
  需复核: '#f59e0b',
}

const elements = {
  heroStats: document.getElementById('hero-stats'),
  metricGrid: document.getElementById('metric-grid'),
  keywordList: document.getElementById('keyword-list'),
  resultSummary: document.getElementById('result-summary'),
  yearChart: document.getElementById('year-chart'),
  mergeChart: document.getElementById('merge-chart'),
  qualityTrack: document.getElementById('quality-track'),
  qualityLegend: document.getElementById('quality-legend'),
  recordList: document.getElementById('record-list'),
  paginationBar: document.getElementById('pagination-bar'),
  recordsSummary: document.getElementById('records-summary'),
  sourcesBody: document.getElementById('sources-body'),
  searchInput: document.getElementById('search-input'),
  yearSelect: document.getElementById('year-select'),
  qualitySelect: document.getElementById('quality-select'),
  fieldSelect: document.getElementById('field-select'),
  sortSelect: document.getElementById('sort-select'),
}

if (window.CORPUS_PAYLOAD) {
  state.payload = window.CORPUS_PAYLOAD
  initializeFilters()
  render()
} else {
  console.error('语料数据未注入')
  elements.recordList.innerHTML = `
    <div class="empty-state">
      <h3>语料数据加载失败</h3>
      <p>请刷新页面后重试。如果问题仍存在，可检查 data.js 是否已正确生成并部署。</p>
    </div>
  `
}

function initializeFilters() {
  const years = ['all', ...state.payload.stats.map((item) => String(item.year))]
  elements.yearSelect.innerHTML = years
    .map((year) => `<option value="${year}">${year === 'all' ? '全部年份' : `${year} 年`}</option>`)
    .join('')

  elements.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value.trim()
    state.page = 1
    render()
  })

  elements.yearSelect.addEventListener('change', (event) => {
    state.year = event.target.value
    state.page = 1
    render()
  })

  elements.qualitySelect.addEventListener('change', (event) => {
    state.quality = event.target.value
    state.page = 1
    render()
  })

  elements.fieldSelect.addEventListener('change', (event) => {
    state.field = event.target.value
    state.page = 1
    render()
  })

  elements.sortSelect.addEventListener('change', (event) => {
    state.sort = event.target.value
    state.page = 1
    render()
  })
}

function render() {
  const filteredRecords = getFilteredRecords()
  const pagedRecords = getPagedRecords(filteredRecords)
  const qualityCounts = countQuality(filteredRecords)
  const filteredZhChars = sum(filteredRecords, 'zhChars')
  const filteredEnWords = sum(filteredRecords, 'enWords')
  const selectedYearStats =
    state.year === 'all' ? null : state.payload.stats.find((item) => String(item.year) === state.year) || null

  renderHeroStats(filteredRecords.length, filteredZhChars, filteredEnWords)
  renderMetricGrid(filteredRecords, qualityCounts, selectedYearStats)
  renderKeywords()
  renderResultSummary(filteredRecords.length)
  renderYearChart()
  renderMergeChart()
  renderQualityChart(qualityCounts, filteredRecords.length)
  renderRecords(filteredRecords, pagedRecords)
  renderPagination(filteredRecords.length)
  renderSources()
}

function getFilteredRecords() {
  const query = state.query.toLowerCase()
  const records = state.payload.corpus.filter((record) => {
    if (state.year !== 'all' && String(record.year) !== state.year) {
      return false
    }

    if (state.quality !== 'all' && record.quality !== state.quality) {
      return false
    }

    if (!query) {
      return true
    }

    const zh = record.zhText.toLowerCase()
    const en = record.enText.toLowerCase()

    if (state.field === 'zh') {
      return zh.includes(query)
    }

    if (state.field === 'en') {
      return en.includes(query)
    }

    return zh.includes(query) || en.includes(query)
  })

  return [...records].sort((left, right) => {
    if (state.sort === 'year-desc') {
      return right.year - left.year || right.segmentId - left.segmentId
    }

    if (state.sort === 'cost-asc') {
      return left.alignmentCost - right.alignmentCost || left.year - right.year
    }

    if (state.sort === 'cost-desc') {
      return right.alignmentCost - left.alignmentCost || left.year - right.year
    }

    return left.year - right.year || left.segmentId - right.segmentId
  })
}

function getPagedRecords(records) {
  const start = (state.page - 1) * state.pageSize
  return records.slice(start, start + state.pageSize)
}

function renderHeroStats(rows, zhChars, enWords) {
  const cards = [
    { label: '当前可浏览语段', value: formatNumber(rows) },
    { label: '当前中文字符', value: formatNumber(zhChars) },
    { label: '当前英文词数', value: formatNumber(enWords) },
  ]

  elements.heroStats.innerHTML = cards
    .map(
      (item) => `
        <article class="hero-stat-card">
          <div class="hero-stat-label">${item.label}</div>
          <div class="hero-stat-value">${item.value}</div>
        </article>
      `
    )
    .join('')
}

function renderMetricGrid(records, qualityCounts, selectedYearStats) {
  const metrics = [
    {
      title: '全库规模',
      value: formatNumber(state.payload.overview.totalRows),
      description: '覆盖 11 年政府工作报告正文，适合政策话语与双语对照研究。',
    },
    {
      title: '平均对齐成本',
      value: state.payload.overview.averageAlignmentCost.toFixed(3),
      description: '成本越低通常表示中英结构越贴近，更适合直接检索与引用。',
    },
    {
      title: '当前质量标签',
      value: `${qualityCounts['高']} / ${qualityCounts['中']} / ${qualityCounts['需复核']}`,
      description: '过滤条件变化时会同步刷新，方便快速定位高质量或需复核语段。',
    },
    {
      title: state.year === 'all' ? '当前年份摘要' : `${state.year} 年摘要`,
      value: selectedYearStats ? `${selectedYearStats.rows} 条` : `${records.length} 条`,
      description: selectedYearStats
        ? `平均英文合并 ${selectedYearStats.avgEnMerge.toFixed(2)} 段，平均成本 ${selectedYearStats.avgCost.toFixed(3)}。`
        : '可切换到具体年份查看年度文本量、合并强度与对齐成本。',
    },
  ]

  elements.metricGrid.innerHTML = metrics
    .map(
      (item) => `
        <article class="metric-card">
          <h3>${item.title}</h3>
          <div class="metric-value">${item.value}</div>
          <p>${item.description}</p>
        </article>
      `
    )
    .join('')
}

function renderKeywords() {
  elements.keywordList.innerHTML = state.payload.overview.topKeywords
    .map(
      (item) => `<button class="keyword-chip" data-keyword="${item.label}" type="button">${item.label} · ${item.count}</button>`
    )
    .join('')

  elements.keywordList.querySelectorAll('.keyword-chip').forEach((button) => {
    button.addEventListener('click', () => {
      state.query = button.dataset.keyword
      state.page = 1
      elements.searchInput.value = state.query
      render()
    })
  })
}

function renderResultSummary(resultCount) {
  elements.resultSummary.innerHTML = `
    当前结果 <strong>${formatNumber(resultCount)}</strong> 条<br />
    当前筛选：${state.year === 'all' ? '全部年份' : `${state.year} 年`} · ${state.quality === 'all' ? '全部质量' : qualityLabelMap[state.quality]} ·
    ${state.field === 'all' ? '中英双语' : state.field === 'zh' ? '仅中文' : '仅英文'}
  `
}

function renderYearChart() {
  const maxRows = Math.max(...state.payload.stats.map((item) => item.rows))
  elements.yearChart.innerHTML = state.payload.stats
    .map((item) => {
      const width = Math.max(8, (item.rows / maxRows) * 100)
      return `
        <div class="year-row">
          <div class="year-label">${item.year}</div>
          <div class="bar-stack">
            <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
            <strong>${item.rows}</strong>
          </div>
          <div class="cost-chip">成本 ${item.avgCost.toFixed(3)}</div>
        </div>
      `
    })
    .join('')
}

function renderMergeChart() {
  const maxMerge = Math.max(...state.payload.stats.map((item) => Math.max(item.avgZhMerge, item.avgEnMerge)))
  elements.mergeChart.innerHTML = state.payload.stats
    .map((item) => {
      const zhWidth = Math.max(6, (item.avgZhMerge / maxMerge) * 100)
      const enWidth = Math.max(6, (item.avgEnMerge / maxMerge) * 100)
      return `
        <div class="merge-row">
          <div class="merge-label">${item.year}</div>
          <div class="merge-stack">
            <div class="merge-item">
              <span>中文合并</span>
              <div class="mini-track"><div class="mini-fill zh" style="width:${zhWidth}%"></div></div>
              <strong>${item.avgZhMerge.toFixed(2)}</strong>
            </div>
            <div class="merge-item">
              <span>英文合并</span>
              <div class="mini-track"><div class="mini-fill en" style="width:${enWidth}%"></div></div>
              <strong>${item.avgEnMerge.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      `
    })
    .join('')
}

function renderQualityChart(qualityCounts, total) {
  const segments = ['高', '中', '需复核']
  elements.qualityTrack.innerHTML = segments
    .map((label) => {
      const ratio = total === 0 ? 0 : (qualityCounts[label] / total) * 100
      return `<div class="quality-fill ${qualityClassMap[label]}" style="width:${ratio}%"></div>`
    })
    .join('')

  elements.qualityLegend.innerHTML = segments
    .map((label) => {
      const count = qualityCounts[label]
      const ratio = total === 0 ? 0 : ((count / total) * 100).toFixed(1)
      return `
        <div class="legend-item">
          <div><span class="legend-dot" style="background:${qualityColorMap[label]}"></span>${label}</div>
          <div>${formatNumber(count)} · ${ratio}%</div>
        </div>
      `
    })
    .join('')
}

function renderRecords(filteredRecords, records) {
  elements.recordsSummary.textContent = `当前命中 ${formatNumber(filteredRecords.length)} 条语料，支持公共网页直接浏览。`

  if (!records.length) {
    elements.recordList.innerHTML = `
      <div class="empty-state">
        <h3>没有匹配到结果</h3>
        <p>可以尝试放宽关键词、切换年份，或移除质量过滤条件。</p>
      </div>
    `
    return
  }

  elements.recordList.innerHTML = records
    .map((record) => {
      const qualityClass = qualityClassMap[record.quality]
      return `
        <article class="record-card">
          <div class="record-head">
            <div class="badge-row">
              <span class="badge year">${record.year} 年</span>
              <span class="badge segment">语段 #${record.segmentId}</span>
              <span class="badge ${qualityClass}">${record.quality}</span>
            </div>
            <div class="record-meta">对齐成本 ${record.alignmentCost.toFixed(3)}</div>
          </div>
          <div class="record-columns">
            <section class="record-column">
              <h4>中文</h4>
              <p class="record-text">${highlight(record.zhText, state.query)}</p>
            </section>
            <section class="record-column">
              <h4>English</h4>
              <p class="record-text">${highlight(record.enText, state.query)}</p>
            </section>
          </div>
          <div class="record-meta">中文字符 ${formatNumber(record.zhChars)} · 英文词数 ${formatNumber(record.enWords)} · 中文合并 ${record.zhGroupSize} 段 · 英文合并 ${record.enGroupSize} 段</div>
          <div class="source-links">
            <a href="${record.zhUrl}" target="_blank" rel="noreferrer">查看中文来源</a>
            <a href="${record.enUrl}" target="_blank" rel="noreferrer">查看英文来源</a>
          </div>
        </article>
      `
    })
    .join('')
}

function renderPagination(totalCount) {
  const pageCount = Math.max(1, Math.ceil(totalCount / state.pageSize))
  if (state.page > pageCount) {
    state.page = pageCount
  }

  const pageNumbers = getPageNumbers(pageCount, state.page)
  elements.paginationBar.innerHTML = `
    <div class="pagination-info">第 ${state.page} / ${pageCount} 页</div>
    <div class="pagination-group">
      <button class="pagination-btn" data-page-action="prev" ${state.page === 1 ? 'disabled' : ''}>上一页</button>
      ${pageNumbers
        .map(
          (pageNumber) =>
            `<button class="page-chip ${pageNumber === state.page ? 'active' : ''}" data-page-number="${pageNumber}">${pageNumber}</button>`
        )
        .join('')}
      <button class="pagination-btn" data-page-action="next" ${state.page === pageCount ? 'disabled' : ''}>下一页</button>
    </div>
  `

  elements.paginationBar.querySelectorAll('[data-page-action]').forEach((button) => {
    button.addEventListener('click', () => {
      state.page += button.dataset.pageAction === 'prev' ? -1 : 1
      render()
      document.getElementById('records-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })

  elements.paginationBar.querySelectorAll('[data-page-number]').forEach((button) => {
    button.addEventListener('click', () => {
      state.page = Number(button.dataset.pageNumber)
      render()
      document.getElementById('records-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}

function renderSources() {
  elements.sourcesBody.innerHTML = state.payload.metadata
    .map(
      (item) => `
        <tr>
          <td><strong>${item.year}</strong></td>
          <td>${item.alignedRows} 条<br /><span class="panel-note">中 ${item.zhParagraphs} 段 · 英 ${item.enCleanParagraphs} 段</span></td>
          <td>${item.avgCost.toFixed(3)}</td>
          <td>
            <div class="source-links-stack">
              <a href="${item.zhUrl}" target="_blank" rel="noreferrer">中文原文</a>
              <a href="${item.enUrl}" target="_blank" rel="noreferrer">英文原文</a>
              <p>${item.sourceNote}</p>
            </div>
          </td>
        </tr>
      `
    )
    .join('')
}

function countQuality(records) {
  return records.reduce(
    (result, record) => {
      result[record.quality] += 1
      return result
    },
    { 高: 0, 中: 0, 需复核: 0 }
  )
}

function getPageNumbers(pageCount, current) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 5]
  }

  if (current >= pageCount - 2) {
    return [pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
  }

  return [current - 2, current - 1, current, current + 1, current + 2]
}

function highlight(text, query) {
  if (!query) {
    return escapeHtml(text)
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return escapeHtml(text).replace(new RegExp(`(${escapedQuery})`, 'gi'), '<mark>$1</mark>')
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function sum(records, key) {
  return records.reduce((total, item) => total + item[key], 0)
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
