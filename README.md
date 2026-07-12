# SCP Archive Terminal

中文 SCP 档案终端首版，采用 Vite、React、TypeScript 和数据驱动档案模型。

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 项目结构

- `src/data/archives.ts`：档案内容与指标数据
- `src/types/archive.ts`：档案数据类型
- `src/components/`：导航、指标卡、雷达图等组件
- `src/assets/echo-well.svg`：本地原创示例主图

新增档案时，在 `archives` 数组中添加新的 `Archive` 对象即可复用页面结构。
