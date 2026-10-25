# Agent Note: Release 构建与发布

Status: implemented

## Problem

项目规则要求只审查修改代码、跳过全量测试，原 Release 工作流却在构建前执行 `npm test`。

## Decision

Release 工作流移除全量测试步骤，保留依赖安装、Chrome/Edge/Opera 与 Firefox 构建、构建内置离线校验以及 ZIP 发布。修改代码在发布前审查。

## Alternatives considered

保留 `npm test` 可继续提供原有全库回归证据，但会违反当前项目规则。手工构建并上传可沿用本地依赖，但标签仍会触发原工作流；沿用修正后的自动发布流程可以统一安装包来源。

## Consequences

后续标签发布仅负责构建与上传。工作流成功提供打包和离线校验证据；交互修复的实际使用效果需在浏览器中确认。
