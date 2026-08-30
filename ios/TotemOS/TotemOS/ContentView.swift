import SwiftUI
import TotemOSKit

struct ContentView: View {
    @EnvironmentObject private var appModel: AppModel
    @EnvironmentObject private var appCoordinator: AppCoordinator
    @State private var isLaunching = true

    var body: some View {
        ZStack(alignment: .top) {
            Color.totemLaunchBackground
                .ignoresSafeArea()

            if appModel.showsNativeLogin {
                NativeLoginView {
                    isLaunching = true
                    appModel.nativeLoginDidSucceed()
                }
                .ignoresSafeArea()
                .transition(.opacity)
            } else {
                // Keep the WKWebView mounted as the authenticated renderer for
                // every private React/Next.js screen. The native shell remains
                // available above it for navigation and session actions.
                LegacyWebRouteView(isVisible: !appCoordinator.shouldUseNativeRoute && appCoordinator.hasLoadedState) {
                    guard appCoordinator.hasLoadedState && !appCoordinator.shouldUseNativeRoute else { return }
                    withAnimation(.easeOut(duration: 0.25)) { isLaunching = false }
                }
                .ignoresSafeArea()
                // React must always be a real, interactive layer while the
                // native-screen migration gate is paused. The opacity branch is
                // retained only for a future, explicitly approved migration.
                .opacity(appCoordinator.shouldUseNativeRoute ? 0.001 : 1)
                .allowsHitTesting(!appCoordinator.shouldUseNativeRoute)

                if appCoordinator.shouldUseNativeRoute {
                    if appCoordinator.snapshot.route == AppRoute.home.path {
                        NativeDashboardView(
                            state: appCoordinator.dashboardState,
                            data: appCoordinator.dashboardData,
                            retry: { await appCoordinator.loadDashboard(forceRefresh: true) },
                            rollback: {
                                if let route = AppRoute(path: appCoordinator.snapshot.route) {
                                    appCoordinator.rollbackToLegacyWeb(for: route)
                                }
                            }
                        )
                        .task { await appCoordinator.loadDashboard() }
                        .onAppear { if appCoordinator.hasLoadedState { isLaunching = false } }
                    } else {
                        NativeRouteView(route: appCoordinator.snapshot.route) {
                            if let route = AppRoute(path: appCoordinator.snapshot.route) {
                                appCoordinator.rollbackToLegacyWeb(for: route)
                            }
                        }
                        .onAppear { if appCoordinator.hasLoadedState { isLaunching = false } }
                    }
                }

                // Shell nativo superpuesto: header, menús y barra inferior.
                NativeShellOverlay()
                    .zIndex(3)
            }

            if isLaunching && !appModel.showsNativeLogin {
                LaunchLoadingView()
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .zIndex(1)
            }

            if appModel.isOffline {
                Label("Sin conexión", systemImage: "wifi.slash")
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.top, 8)
                    .accessibilityIdentifier("offline-banner")
                    .zIndex(2)
            }
        }
        .background(Color.totemLaunchBackground.ignoresSafeArea())
        .preferredColorScheme(appCoordinator.snapshot.theme == .dark ? .dark : .light)
        .onChange(of: appCoordinator.hasLoadedState) { _, loaded in
            if loaded && !appCoordinator.shouldUseNativeRoute {
                withAnimation(.easeOut(duration: 0.2)) { isLaunching = false }
            }
        }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
    }
}

private struct NativeRouteView: View {
    let route: String
    let rollback: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "swift")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(.tint)
            Text("Pantalla nativa en migración")
                .font(.title3.weight(.semibold))
            Text(route)
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
            Button("Usar versión web") { rollback() }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("legacy-route-rollback")
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .systemBackground))
        .foregroundStyle(.primary)
    }
}

private struct LaunchLoadingView: View {
    var body: some View {
        ZStack {
            Color.totemLaunchBackground

            VStack(spacing: 24) {
                Image("AppIconArtwork")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 112, height: 112)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .shadow(color: .black.opacity(0.35), radius: 24, y: 12)

                ProgressView()
                    .tint(.white.opacity(0.8))
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Cargando Totem OS")
    }
}

private extension Color {
    static let totemLaunchBackground = Color(
        red: 20 / 255,
        green: 18 / 255,
        blue: 32 / 255
    )
}
