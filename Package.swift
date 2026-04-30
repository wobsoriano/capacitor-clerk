// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorClerk",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "CapacitorClerk", targets: ["CapacitorClerkNative"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm", from: "8.0.0"),
        .package(url: "https://github.com/clerk/clerk-ios", from: "1.0.0"),
    ],
    targets: [
        .target(
            name: "CapacitorClerkNative",
            dependencies: [
                .product(name: "Capacitor",  package: "capacitor-swift-pm"),
                .product(name: "Cordova",    package: "capacitor-swift-pm"),
                .product(name: "ClerkKit",   package: "clerk-ios"),
                .product(name: "ClerkKitUI", package: "clerk-ios"),
            ],
            path: "ios/Sources/CapacitorClerkNative"
        ),
    ]
)
