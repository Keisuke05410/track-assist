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
| タイムラインUI | Vanilla JS |

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
open http://localhost:19080
```

## 主要な依存関係

- [GRDB.swift](https://github.com/groue/GRDB.swift) - SQLite ORM
- [FlyingFox](https://github.com/swhitty/FlyingFox) - 軽量HTTPサーバー

## 注意事項

- **アクセシビリティ権限**: ウィンドウタイトル取得に必要。初回起動時にシステム環境設定で許可
- **データ保持**: SQLiteに保存、1週間で自動削除
- **ポート**: localhost:19080 を使用

## 公開リポジトリのルール

このリポジトリは公開されているため、以下を遵守すること：

### コミット禁止ファイル

- `install-service.sh` - ローカルインストール用スクリプト
- `*.plist`（`TrackAssist/Resources/Info.plist`を除く） - LaunchAgent設定など
- `.mailmap` - メールアドレス変換用
- ユーザー名やホームディレクトリパスを含むファイル

### 個人情報の取り扱い

- ユーザー名（例: `/Users/xxxxx/`）を含むパスをハードコードしない
- LaunchAgent用plistはローカルで生成し、コミットしない
- バンドルIDには個人を特定できる名前を使わない

## 開発ワークフロー

### UI変更時の確認

Web UI（`Resources/Web/`）を変更した場合は、必ずPlaywrightでブラウザ確認を行うこと:

1. アプリをビルド・起動: `swift build && swift run TrackAssist`
2. Playwrightで http://localhost:19080 にアクセス
3. スナップショットまたはスクリーンショットで表示を確認
4. 白い画面やレイアウト崩れがないことを確認してから完了とする

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
