// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorClerk",
    platforms: [.iOS(.v17)],
    products: [
        .library(
            name: "CapacitorClerk",
            targets: ["CapacitorClerk"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "CapacitorClerk",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/ClerkPluginPlugin"),
        .testTarget(
            name: "CapacitorClerkTests",
            dependencies: ["CapacitorClerk"],
            path: "ios/Tests/ClerkPluginPluginTests")
    ]
)