import SwiftUI
import TotemOSKit

struct NativeDashboardView: View {
    let state: DashboardLoadState
    let data: DashboardData?
    let retry: () -> Void
    let rollback: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header

                    if state == .offline || state == .error {
                        stateBanner
                    }

                    if state == .loading && data == nil {
                        loadingView
                    } else if state == .empty {
                        emptyView
                    } else if let data {
                        dashboardContent(data)
                        if state == .loading {
                            Text("Actualizando datos…")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity)
                        }
                    } else if state == .offline {
                        offlineView
                    } else {
                        errorView
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 76)
                .padding(.bottom, 112)
            }
            .scrollIndicators(.hidden)
        }
        .accessibilityIdentifier("native-dashboard")
        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.9), value: state)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Command center")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                Text("Buenos días, \(firstName)")
                    .font(.system(.largeTitle, design: .rounded).weight(.bold))
                    .foregroundStyle(.primary)
                Text("Una vista tranquila de lo que merece tu atención.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            HStack(spacing: 8) {
                Button(action: retry) {
                    Image(systemName: "arrow.clockwise")
                        .font(.body.weight(.semibold))
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.bordered)
                .disabled(state == .loading)
                .accessibilityLabel("Actualizar dashboard")
                .accessibilityIdentifier("dashboard-refresh")

                Button("Web", action: rollback)
                    .buttonStyle(.bordered)
                    .accessibilityLabel("Usar versión web")
                    .accessibilityIdentifier("dashboard-rollback")
            }
        }
    }

    private var firstName: String {
        data?.user.name.split(separator: " ").first.map(String.init) ?? "Usuario"
    }

    private var stateBanner: some View {
        Label(
            state == .offline ? "Sin conexión · mostrando el último dashboard guardado" : "No se pudo actualizar · mostrando el último dashboard guardado",
            systemImage: state == .offline ? "wifi.slash" : "exclamationmark.triangle"
        )
        .font(.footnote.weight(.medium))
        .foregroundStyle(state == .offline ? .orange : .red)
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(state == .offline ? "dashboard-offline" : "dashboard-error")
    }

    private var loadingView: some View {
        VStack(alignment: .leading, spacing: 14) {
            ProgressView().tint(.accentColor).accessibilityIdentifier("dashboard-loading")
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(.quaternary)
                    .frame(height: 110)
                    .redacted(reason: .placeholder)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Cargando dashboard")
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 42, weight: .medium))
                .foregroundStyle(.green)
            Text("Todo despejado")
                .font(.title3.weight(.semibold))
            Text("Todavía no hay clientes ni tareas para mostrar.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Actualizar", action: retry).buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44)
        .accessibilityIdentifier("dashboard-empty")
    }

    private var offlineView: some View {
        emptyState(icon: "wifi.slash", title: "Sin conexión", message: "Conecta el iPhone para cargar el dashboard.")
            .accessibilityIdentifier("dashboard-offline")
    }

    private var errorView: some View {
        emptyState(icon: "exclamationmark.triangle", title: "No se pudo cargar", message: "Revisa tu sesión e inténtalo nuevamente.")
            .accessibilityIdentifier("dashboard-error")
    }

    private func emptyState(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 36, weight: .medium)).foregroundStyle(.secondary)
            Text(title).font(.title3.weight(.semibold))
            Text(message).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button("Reintentar", action: retry).buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44)
    }

    private func dashboardContent(_ dashboard: DashboardData) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                MetricCard(title: "Clientes activos", value: "\(dashboard.summary.activeClients)", detail: "En operación", icon: "person.2")
                MetricCard(title: "Tareas asignadas", value: "\(dashboard.summary.assignedTasks)", detail: "\(dashboard.summary.priorityTasks) prioritarias", icon: "checklist", tint: dashboard.summary.priorityTasks > 0 ? .orange : .accentColor)
                MetricCard(title: "Aprobaciones", value: "\(dashboard.summary.pendingApprovals)", detail: "Feedback y entregas", icon: "checkmark.seal", tint: .blue)
                MetricCard(title: "Publicadas", value: "\(dashboard.summary.publishedThisMonth)", detail: "Este mes", icon: "checkmark.circle", tint: .green)
            }

            DashboardSection(title: "Agenda de hoy", subtitle: "\(dashboard.summary.scheduledToday) actividades programadas", icon: "calendar") {
                if dashboard.agenda.isEmpty { EmptySectionText("No hay actividades programadas para hoy.") }
                else { ForEach(dashboard.agenda, id: \.id, content: TaskRow.init) }
            }

            DashboardSection(title: "Requieren atención", subtitle: "Próximos cuatro días", icon: "exclamationmark.circle") {
                if dashboard.priorityTasks.isEmpty { EmptySectionText("Todo al día por ahora.", tint: .green) }
                else { ForEach(dashboard.priorityTasks, id: \.id, content: TaskRow.init) }
            }

            DashboardSection(title: "Pipeline", subtitle: "Producción del mes", icon: "square.grid.2x2") {
                ForEach(dashboard.pipeline, id: \.key) { stage in
                    HStack(spacing: 10) {
                        Text(stage.label).font(.caption).foregroundStyle(.secondary).frame(width: 82, alignment: .leading)
                        ProgressView(value: Double(stage.count), total: Double(max(1, dashboard.summary.assignedTasks))).tint(.accentColor)
                        Text("\(stage.count)").font(.caption.weight(.semibold)).frame(width: 24, alignment: .trailing)
                    }
                }
            }

            if !dashboard.workloads.isEmpty {
                DashboardSection(title: "Capacidad del equipo", subtitle: "Tareas pendientes", icon: "person.3") {
                    ForEach(dashboard.workloads, id: \.userId) { workload in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text(workload.userName).font(.subheadline); Spacer(); Text("\(workload.pendingTasksCount)/\(workload.weeklyCapacity)").font(.caption).foregroundStyle(.secondary) }
                            ProgressView(value: min(1, workload.utilizationPct / 100)).tint(workload.utilizationPct >= 80 ? .orange : .accentColor)
                        }
                    }
                }
            }

            if dashboard.user.role == "ADMIN" {
                DashboardSection(title: "Resumen financiero", subtitle: "Visión administrativa", icon: "dollarsign.circle") {
                    HStack(spacing: 12) {
                        FinanceTile(title: "Ingresos", value: dashboard.summary.totalIncome)
                        FinanceTile(title: "Por cobrar", value: dashboard.summary.totalReceivable)
                    }
                }
            }
        }
    }
}

private struct MetricCard: View {
    let title: String
    let value: String
    let detail: String
    let icon: String
    var tint: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Image(systemName: icon).foregroundStyle(tint); Spacer(); Text(value).font(.title2.weight(.bold)).foregroundStyle(tint) }
            Text(title).font(.caption.weight(.medium)).foregroundStyle(.secondary)
            Text(detail).font(.caption2).foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

private struct DashboardSection<Content: View>: View {
    let title: String
    let subtitle: String
    let icon: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) { Image(systemName: icon).foregroundStyle(.secondary); VStack(alignment: .leading, spacing: 2) { Text(title).font(.headline); Text(subtitle).font(.caption).foregroundStyle(.secondary) } }
            VStack(spacing: 10) { content }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
    }
}

private struct TaskRow: View {
    let task: DashboardTask

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "circle.fill").font(.system(size: 7)).foregroundStyle(task.priority == "URGENT" || task.priority == "HIGH" ? .orange : .secondary)
            VStack(alignment: .leading, spacing: 3) { Text(task.title).font(.subheadline.weight(.medium)).lineLimit(1); Text("\(task.client.name) · \(dateLabel)").font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            Spacer(minLength: 4)
            Text(task.priority).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var dateLabel: String {
        let raw = task.scheduledAt ?? task.dueDate
        guard let raw, let date = ISO8601DateFormatter().date(from: raw) else { return "Sin fecha" }
        return date.formatted(.dateTime.day().month(.abbreviated).hour().minute())
    }
}

private struct EmptySectionText: View {
    let text: String
    var tint: Color = .secondary
    init(_ text: String, tint: Color = .secondary) { self.text = text; self.tint = tint }
    var body: some View { Text(text).font(.subheadline).foregroundStyle(tint).frame(maxWidth: .infinity, alignment: .leading) }
}

private struct FinanceTile: View {
    let title: String
    let value: Double?
    var body: some View {
        VStack(alignment: .leading, spacing: 5) { Text(title).font(.caption).foregroundStyle(.secondary); Text(value.map { $0.formatted(.currency(code: "USD")) } ?? "—").font(.headline) }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
