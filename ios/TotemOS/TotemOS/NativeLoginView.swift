import SwiftUI
import UIKit

struct NativeLoginView: View {
    let onAuthenticated: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var isPasswordVisible = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private enum Field: Hashable {
        case email
        case password
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 20 / 255, green: 18 / 255, blue: 32 / 255),
                    Color(red: 38 / 255, green: 31 / 255, blue: 61 / 255),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            Circle()
                .fill(Color.purple.opacity(0.34))
                .frame(width: 320, height: 320)
                .blur(radius: 70)
                .offset(x: 150, y: -260)
                .accessibilityHidden(true)

            Circle()
                .fill(Color.blue.opacity(0.18))
                .frame(width: 280, height: 280)
                .blur(radius: 80)
                .offset(x: -160, y: 310)
                .accessibilityHidden(true)

            ScrollView {
                VStack(spacing: 30) {
                    Spacer(minLength: 30)

                    VStack(spacing: 18) {
                        Image("AppIconArtwork")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 104, height: 104)
                            .clipShape(RoundedRectangle(cornerRadius: 23, style: .continuous))
                            .shadow(color: .black.opacity(0.35), radius: 24, y: 12)

                        VStack(spacing: 8) {
                            Text("Bienvenido a Totem OS")
                                .font(TotemTypography.bold(30, relativeTo: .largeTitle))
                                .foregroundStyle(.white)

                            Text("Inicia sesión para continuar")
                                .font(TotemTypography.regular(16, relativeTo: .body))
                                .foregroundStyle(.white.opacity(0.62))
                        }
                    }

                    VStack(spacing: 16) {
                        loginField(
                            title: "Correo electrónico",
                            systemImage: "envelope",
                            field: .email
                        ) {
                            TextField("tu@email.com", text: $email)
                                .font(TotemTypography.regular(17, relativeTo: .body))
                                .textContentType(.username)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focusedField, equals: .email)
                                .submitLabel(.next)
                                .onSubmit { focusedField = .password }
                        }

                        loginField(
                            title: "Contraseña",
                            systemImage: "lock",
                            field: .password
                        ) {
                            Group {
                                if isPasswordVisible {
                                    TextField("Contraseña", text: $password)
                                } else {
                                    SecureField("Contraseña", text: $password)
                                }
                            }
                            .font(TotemTypography.regular(17, relativeTo: .body))
                            .textContentType(.password)
                            .focused($focusedField, equals: .password)
                            .submitLabel(.go)
                            .onSubmit { signIn() }

                            Button {
                                isPasswordVisible.toggle()
                            } label: {
                                Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                                    .foregroundStyle(.white.opacity(0.58))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(
                                isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"
                            )
                        }

                        if let errorMessage {
                            Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                                .font(TotemTypography.regular(13, relativeTo: .footnote))
                                .foregroundStyle(Color(red: 1, green: 0.55, blue: 0.62))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityIdentifier("native-login-error")
                        }

                        signInButton
                    }

                    Text("Tus credenciales se envían de forma segura y no se guardan en el dispositivo.")
                        .font(TotemTypography.regular(12, relativeTo: .caption))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white.opacity(0.45))
                        .padding(.horizontal, 18)

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var canSubmit: Bool {
        !isSubmitting && email.contains("@") && !password.isEmpty
    }

    @ViewBuilder
    private var signInButton: some View {
        if #available(iOS 26.0, *) {
            submitControl
                .buttonStyle(.plain)
                .foregroundStyle(Color(red: 0.08, green: 0.08, blue: 0.08))
                .glassEffect(
                    .regular.tint(Color.totemLime).interactive(),
                    in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                )
        } else {
            submitControl
                .buttonStyle(TotemPrimaryButtonStyle())
        }
    }

    private var submitControl: some View {
        Button(action: signIn) {
            HStack(spacing: 10) {
                if isSubmitting {
                    ProgressView()
                        .tint(Color(red: 0.08, green: 0.08, blue: 0.08))
                }
                Text(isSubmitting ? "Iniciando sesión…" : "Iniciar sesión")
                    .font(TotemTypography.bold(17, relativeTo: .headline))
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .simultaneousGesture(TapGesture().onEnded { signIn() })
        .opacity(canSubmit ? 1 : 0.55)
        .disabled(!canSubmit)
        .accessibilityIdentifier("native-login-submit")
    }

    private func loginField<Content: View>(
        title: String,
        systemImage: String,
        field: Field,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(TotemTypography.medium(14, relativeTo: .footnote))
                .foregroundStyle(.white.opacity(0.72))

            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .frame(width: 18)
                    .foregroundStyle(.white.opacity(0.58))

                content()
                    .foregroundStyle(.white)
                    .tint(.white)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 56)
            .totemGlassSurface(
                cornerRadius: 18,
                isFocused: focusedField == field,
                reduceTransparency: reduceTransparency
            )
        }
    }

    private func signIn() {
        guard canSubmit else { return }
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        focusedField = nil
        errorMessage = nil
        isSubmitting = true

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let submittedPassword = password
        password = ""

        Task {
            do {
                try await NativeAuthService().signIn(
                    email: normalizedEmail,
                    password: submittedPassword
                )
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                isSubmitting = false
                onAuthenticated()
            } catch {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
                isSubmitting = false
                errorMessage = (error as? LocalizedError)?.errorDescription
                    ?? NativeAuthenticationError.unavailable.localizedDescription
            }
        }
    }
}
