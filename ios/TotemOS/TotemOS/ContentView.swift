import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appModel: AppModel
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
                WebAppView {
                    withAnimation(.easeOut(duration: 0.25)) {
                        isLaunching = false
                    }
                }
                .ignoresSafeArea()

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
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
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
