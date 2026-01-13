// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TrackAssist",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "TrackAssist", targets: ["TrackAssist"])
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.24.0"),
        .package(url: "https://github.com/swhitty/FlyingFox.git", from: "0.14.0")
    ],
    targets: [
        .executableTarget(
            name: "TrackAssist",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
                .product(name: "FlyingFox", package: "FlyingFox")
            ],
            path: "TrackAssist",
            resources: [
                .copy("Resources/Web")
            ]
        )
    ]
)
