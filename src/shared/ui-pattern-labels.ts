import type { SupportedLocale } from './types';

const chinesePatternNames: Record<string, string> = {
  Header: '页眉',
  'Navigation Bar': '导航栏',
  'Hero Section': '首屏主视觉区',
  Footer: '页脚',
  Sidebar: '侧边栏',
  'Primary Button': '主要按钮',
  'Secondary Button': '次要按钮',
  'Icon Button': '图标按钮',
  'Dropdown Button': '下拉按钮',
  Card: '卡片',
  Modal: '模态框',
  Dialog: '对话框',
  Drawer: '抽屉面板',
  'Bottom Sheet': '底部面板',
  Tooltip: '工具提示',
  Tabs: '标签页',
  Accordion: '折叠面板',
  'Search Bar': '搜索栏',
  'Text Field': '文本输入框',
  Select: '选择器',
  Checkbox: '复选框',
  'Radio Button': '单选按钮',
  Badge: '徽标',
  Avatar: '头像',
  Breadcrumb: '面包屑导航',
  Table: '表格',
  'List Item': '列表项',
  'Video Frame': '视频帧',
  Section: '区块',
  'Unknown Element': '未知元素',
};

export function localizedPatternName(
  englishName: string,
  japaneseName: string,
  locale: SupportedLocale,
): string {
  if (locale === 'ja') return japaneseName;
  if (locale === 'zh') return chinesePatternNames[englishName] ?? englishName;
  return englishName;
}
