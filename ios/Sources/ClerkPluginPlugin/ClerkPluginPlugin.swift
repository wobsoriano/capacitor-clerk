import Capacitor
import Foundation

@objc(ClerkPluginPlugin)
public class ClerkPluginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClerkPluginPlugin"
    public let jsName = "ClerkPlugin"
    public let pluginMethods: [CAPPluginMethod] = []

    // Methods are added in subsequent tasks.
}
