import SwiftUI
import TotemOSKit

/// Listado de notificaciones recientes con paridad respecto a la web:
/// marcar como leída y acceso a "Ver todas".
struct ShellNotificationsView: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if shell.snapshot.notifications.isEmpty {
                    Text("No tienes notificaciones nuevas")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(shell.snapshot.notifications) { notification in
                        Button {
                            shell.send(.markNotificationRead(id: notification.id))
                        } label: {
                            row(for: notification)
                        }
                        .buttonStyle(.plain)
                        .disabled(notification.read)
                    }
                }

                Button("Ver todas las notificaciones") {
                    dismiss()
                    shell.navigate(to: "/admin/notifications")
                }
                .frame(minHeight: shellMinimumTapTarget)
            }
            .navigationTitle("Notificaciones")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Listo") { dismiss() }
                }
            }
        }
    }

    private func row(for notification: ShellNotification) -> some View {
        HStack(alignment: .top, spacing: 12) {
            if let avatarUrl = notification.avatarUrl, let url = ShellAsset.url(for: avatarUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Circle().fill(.secondary.opacity(0.25))
                }
                .frame(width: 32, height: 32)
                .clipShape(Circle())
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(notification.message)
                    .font(.subheadline)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    if let author = notification.authorName {
                        Text(author)
                    }
                    Text(notification.relativeDateText)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            if !notification.read {
                Circle()
                    .fill(Color.accentColor)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)
                    .accessibilityLabel("Sin leer")
            }
        }
        .frame(minHeight: shellMinimumTapTarget)
        .contentShape(Rectangle())
    }
}
