# TrackAssist

macOS用のローカル完結型アクティビティトラッカー。

## プロジェクト概要

- **目的**: 作業内容をToggl Trackに転記するための参照用途
- **対応OS**: macOS 13 (Ventura) 以降
- **言語**: Swift

## 技術スタック

| 項目 | 技術 |
|------|------|
| UI | AppKit (NSStatusItem) + SwiftUI |
| データベース | SQLite (GRDB.swift) |
| Webサーバー | FlyingFox |
| タイムラインUI | Vanilla JS + Canvas |

## ディレクトリ構成

```
TrackAssist/
├── App/           # アプリエントリポイント、AppDelegate
├── Core/          # トラッキング、アイドル検出、アクセシビリティ
├── Database/      # GRDB設定、モデル
├── Server/        # FlyingFox HTTPサーバー、APIルート
├── UI/            # SwiftUI メニューバービュー
└── Resources/Web/ # タイムラインHTML/CSS/JS
```

## ビルド・実行

```bash
# ビルド
swift build

# 実行
swift run TrackAssist

# タイムライン表示
open http://localhost:8080
```

## 主要な依存関係

- [GRDB.swift](https://github.com/groue/GRDB.swift) - SQLite ORM
- [FlyingFox](https://github.com/swhitty/FlyingFox) - 軽量HTTPサーバー

## 注意事項

- **アクセシビリティ権限**: ウィンドウタイトル取得に必要。初回起動時にシステム環境設定で許可
- **データ保持**: SQLiteに保存、1週間で自動削除
- **ポート**: localhost:8080 を使用

## データベース

- 場所: `~/Library/Application Support/TrackAssist/activities.sqlite`
- スキーマ変更時は既存DBを削除: `rm -rf ~/Library/Application\ Support/TrackAssist/`

## API

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/status` | 現在のトラッキング状態 |
| `GET /api/activities?date=YYYY-MM-DD` | 指定日のアクティビティ |
| `GET /api/timeline?date=YYYY-MM-DD` | タイムラインセグメント |
| `GET /api/summary?date=YYYY-MM-DD` | アプリ別集計 |
