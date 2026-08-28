import SwiftUI

struct NativeLoginView: View {
    let onAuthenticated: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var isPasswordVisible = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

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
                                .font(.system(size: 30, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)

                            Text("Inicia sesión para continuar")
                                .font(.subheadline)
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
                                .font(.footnote)
                                .foregroundStyle(Color(red: 1, green: 0.55, blue: 0.62))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityIdentifier("native-login-error")
                        }

                        Button(action: signIn) {
                            HStack(spacing: 10) {
                                if isSubmitting {
                                    ProgressView()
                                        .tint(Color(red: 0.08, green: 0.08, blue: 0.08))
                                }
                                Text(isSubmitting ? "Iniciando sesión…" : "Iniciar sesión")
                                    .fontWeight(.bold)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Color(red: 0.08, green: 0.08, blue: 0.08))
                        .background(
                            Color(red: 159 / 255, green: 232 / 255, blue: 66 / 255),
                            in: RoundedRectangle(cornerRadius: 17, style: .continuous)
                        )
                        .opacity(canSubmit ? 1 : 0.55)
                        .disabled(!canSubmit)
                        .accessibilityIdentifier("native-login-submit")
                    }
                    .padding(22)
                    .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 28))
                    .overlay {
                        RoundedRectangle(cornerRadius: 28)
                            .stroke(.white.opacity(0.10), lineWidth: 1)
                    }

                    Text("Tus credenciales se envían de forma segura y no se guardan en el dispositivo.")
                        .font(.caption)
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

    private func loginField<Content: View>(
        title: String,
        systemImage: String,
        field: Field,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.footnote.weight(.semibold))
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
            .frame(height: 54)
            .background(.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        focusedField == field ? .white.opacity(0.38) : .white.opacity(0.10),
                        lineWidth: 1
                    )
            }
        }
    }

    private func signIn() {
        guard canSubmit else { return }
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
                isSubmitting = false
                onAuthenticated()
            } catch {
                isSubmitting = false
                errorMessage = (error as? LocalizedError)?.errorDescription
                    ?? NativeAuthenticationError.unavailable.localizedDescription
            }
        }
    }
}
