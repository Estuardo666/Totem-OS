import SwiftUI
import UIKit
import TotemOSKit

struct NativeDashboardView: View {
    let state: DashboardLoadState
    let data: DashboardData?
    let retry: () -> Void
    let rollback: () -> Void

    @EnvironmentObject private var coordinator: AppCoordinator
    @State private var isRefreshing = false

    private var palette: TotemThemePalette { coordinator.themePalette }

    var body: some View {
        ZStack {
            palette.background
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
                // Clear the floating native header instead of drawing beneath it.
                .padding(.top, 92)
                .padding(.bottom, 112)
            }
            .scrollIndicators(.hidden)
        }
        .accessibilityIdentifier("native-dashboard")
        .foregroundStyle(palette.foreground)
        .tint(palette.accent)
        .onChange(of: state) { _, next in
            if next != .loading { isRefreshing = false }
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Command center")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(palette.secondaryText)
                Text("Buenos días, \(firstName)")
                    .font(.system(.largeTitle, design: .default).weight(.bold))
                    .foregroundStyle(palette.foreground)
                Text(todaySummary)
                    .font(.subheadline)
                    .foregroundStyle(palette.secondaryText)
            }
            Spacer(minLength: 8)
            HStack(spacing: 8) {
                Button {
                    guard state != .loading, !isRefreshing else { return }
                    isRefreshing = true
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    retry()
                } label: {
                    Group {
                        if isRefreshing {
                            ProgressView().controlSize(.small)
                        } else {
                            Image(systemName: "arrow.clockwise")
                                .font(.body.weight(.semibold))
                        }
                    }
                    .frame(width: 40, height: 40)
                }
                .buttonStyle(.bordered)
                .disabled(state == .loading || isRefreshing)
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

    private var todaySummary: String {
        guard let data else { return "Una vista tranquila de lo que merece tu atención." }
        return "\(data.summary.scheduledToday) actividades y \(data.summary.priorityTasks) tareas requieren atención hoy."
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
        .totemDashboardCard(palette: palette, cornerRadius: 16)
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
                if dashboard.user.role == "ADMIN" {
                    MetricCard(title: "Ingresos del mes", value: currency(dashboard.summary.totalIncome), detail: "Cobrado este mes", icon: "wallet.pass", tint: .green)
                    MetricCard(title: "Saldo pendiente", value: currency(dashboard.summary.totalReceivable), detail: "Total por cobrar", icon: "doc.text", tint: .orange)
                }
                MetricCard(title: "Vencidas en edición", value: "\(dashboard.summary.overdueEditingTasks)", detail: dashboard.summary.overdueEditingTasks == 0 ? "Edición al día" : "Siguen en edición", icon: "exclamationmark.triangle", tint: dashboard.summary.overdueEditingTasks == 0 ? .green : .red)
                MetricCard(title: "Vencidas publicación", value: "\(dashboard.summary.overduePublicationTasks)", detail: dashboard.summary.overduePublicationTasks == 0 ? "Publicación al día" : "Pendientes de publicar", icon: "doc.badge.clock", tint: dashboard.summary.overduePublicationTasks == 0 ? .green : .red)
                MetricCard(title: "Contenido publicado", value: "\(dashboard.summary.publishedThisMonth)", detail: "Este mes", icon: "rectangle.stack.badge.checkmark", tint: .blue)
                MetricCard(title: dashboard.user.role == "ADMIN" ? "Clientes activos" : "Tareas asignadas", value: "\(dashboard.user.role == "ADMIN" ? dashboard.summary.activeClients : dashboard.summary.assignedTasks)", detail: dashboard.user.role == "ADMIN" ? "En el sistema" : roleLabel(dashboard.user.specialty), icon: dashboard.user.role == "ADMIN" ? "person.2" : "checklist")
            }

            DashboardSection(title: "Agenda de hoy", subtitle: "\(dashboard.summary.scheduledToday) actividades programadas", icon: "calendar") {
                if dashboard.agenda.isEmpty { EmptySectionText("No hay actividades programadas para hoy.") }
                else { ForEach(dashboard.agenda, id: \.id, content: TaskRow.init) }
            }

            DashboardSection(title: "Requieren atención", subtitle: "Próximos cuatro días", icon: "exclamationmark.circle") {
                if dashboard.priorityTasks.isEmpty { EmptySectionText("Todo al día por ahora.", tint: .green) }
                else { ForEach(dashboard.priorityTasks, id: \.id, content: TaskRow.init) }
            }

            DashboardSection(title: "Pipeline de contenido", subtitle: "Estado de las piezas del mes", icon: "square.grid.2x2") {
                PipelineOverview(stages: dashboard.pipeline)
            }

            if !dashboard.workloads.isEmpty {
                DashboardSection(title: "Capacidad del equipo", subtitle: "Carga semanal por integrante", icon: "gauge.with.dots.needle.67percent") {
                    ForEach(dashboard.workloads, id: \.userId) { workload in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                DashboardRemoteAvatar(urlValue: workload.userImageUrl, name: workload.userName, circular: true)
                                Text(workload.userName).font(.subheadline.weight(.medium))
                                Spacer()
                                Text("\(Int(workload.utilizationPct))%").font(.caption.weight(.semibold)).foregroundStyle(workloadColor(workload.utilizationPct))
                            }
                            Text("\(workload.userSpecialty ?? "Equipo") · \(workloadStatus(workload.utilizationPct))").font(.caption).foregroundStyle(.secondary)
                            HStack {
                                ProgressView(value: min(1, workload.utilizationPct / 100)).tint(workloadColor(workload.utilizationPct))
                                Text("\(workload.pendingTasksCount)/\(workload.weeklyCapacity)").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            DashboardSection(title: "Esperando aprobación", subtitle: "\(dashboard.approvals.count) elementos en revisión", icon: "doc.badge.clock") {
                if dashboard.approvals.isEmpty { EmptySectionText("Nada esperando aprobación.", tint: .green) }
                else { ForEach(dashboard.approvals.prefix(5), id: \.id, content: ApprovalRow.init) }
            }

            if dashboard.user.role == "ADMIN" {
                DashboardSection(title: "Resumen financiero", subtitle: "Lectura ejecutiva del mes", icon: "wallet.pass") {
                    HStack(spacing: 12) {
                        FinanceTile(title: "Cobrado", value: dashboard.summary.totalIncome, tint: .green)
                        FinanceTile(title: "Pendiente", value: dashboard.summary.totalReceivable, tint: .orange)
                    }
                    ForEach(dashboard.recentTransactions, id: \.id, content: TransactionRow.init)
                }
            } else {
                DashboardSection(title: "Próximas entregas", subtitle: "Fechas que se acercan", icon: "clock") {
                    if dashboard.priorityTasks.isEmpty { EmptySectionText("No hay entregas próximas.", tint: .green) }
                    else { ForEach(dashboard.priorityTasks.prefix(3), id: \.id, content: TaskRow.init) }
                }
            }

            DashboardSection(title: "Rendimiento del mes", subtitle: "Señales rápidas del período", icon: "chart.line.uptrend.xyaxis") {
                PerformanceGrid(summary: dashboard.summary)
            }
        }
    }

    private func currency(_ value: Double?) -> String {
        value?.formatted(.currency(code: "USD")) ?? "—"
    }

    private func roleLabel(_ specialty: String?) -> String {
        specialty?.capitalized ?? "Equipo de contenido"
    }

    private func workloadColor(_ utilization: Double) -> Color {
        if utilization >= 100 { return .red }
        if utilization >= 80 { return .orange }
        if utilization >= 50 { return .blue }
        return .green
    }

    private func workloadStatus(_ utilization: Double) -> String {
        if utilization >= 100 { return "Sobrecargado" }
        if utilization >= 80 { return "Cerca del límite" }
        if utilization >= 50 { return "Ocupación saludable" }
        return "Disponible"
    }
}

private struct MetricCard: View {
    let title: String
    let value: String
    let detail: String
    let icon: String
    var tint: Color = .accentColor
    @EnvironmentObject private var coordinator: AppCoordinator

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Image(systemName: icon).foregroundStyle(tint); Spacer(); Text(value).font(.title2.weight(.bold)).foregroundStyle(tint) }
            Text(title).font(.caption.weight(.medium)).foregroundStyle(.secondary)
            Text(detail).font(.caption2).foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .totemDashboardCard(palette: coordinator.themePalette, cornerRadius: 22)
    }
}

private struct DashboardSection<Content: View>: View {
    let title: String
    let subtitle: String
    let icon: String
    @ViewBuilder var content: Content
    @EnvironmentObject private var coordinator: AppCoordinator

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) { Image(systemName: icon).foregroundStyle(.secondary); VStack(alignment: .leading, spacing: 2) { Text(title).font(.headline); Text(subtitle).font(.caption).foregroundStyle(.secondary) } }
            VStack(spacing: 10) { content }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .totemDashboardCard(palette: coordinator.themePalette, cornerRadius: 26)
    }
}

private struct TaskRow: View {
    let task: DashboardTask

    var body: some View {
        HStack(spacing: 10) {
            DashboardRemoteAvatar(urlValue: task.client.logoUrl, name: task.client.name, circular: false)
            VStack(alignment: .leading, spacing: 3) { Text(task.title).font(.subheadline.weight(.medium)).lineLimit(1); Text("\(task.client.name) · \(dateLabel)").font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            Spacer(minLength: 4)
            if let assignee = task.assignedTo {
                DashboardRemoteAvatar(urlValue: assignee.imageUrl, name: assignee.name, circular: true)
            } else {
                Text(task.priority).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            }
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

private struct ApprovalRow: View {
    let approval: DashboardApproval

    var body: some View {
        HStack(spacing: 11) {
            DashboardRemoteAvatar(urlValue: approval.clientLogoUrl, name: approval.clientName, circular: false)
            VStack(alignment: .leading, spacing: 3) {
                Text(approval.title).font(.subheadline.weight(.medium)).lineLimit(1)
                Text("\(approval.clientName) · \(relativeDate(approval.updatedAt))")
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 4)
            Text(waitingLabel(approval.updatedAt))
                .font(.caption2.weight(.medium))
                .foregroundStyle(isLate(approval.updatedAt) ? .orange : .secondary)
        }
        .padding(.vertical, 4)
    }

    private func parsed(_ value: String) -> Date? { ISO8601DateFormatter().date(from: value) }
    private func isLate(_ value: String) -> Bool { parsed(value).map { Date().timeIntervalSince($0) > 48 * 3600 } ?? false }
    private func waitingLabel(_ value: String) -> String { isLate(value) ? "+48 h" : "En plazo" }
    private func relativeDate(_ value: String) -> String {
        guard let date = parsed(value) else { return "Sin fecha" }
        return date.formatted(.relative(presentation: .named))
    }
}

private struct DashboardRemoteAvatar: View {
    let urlValue: String?
    let name: String
    let circular: Bool

    var body: some View {
        Group {
            if let urlValue, let url = ShellAsset.url(for: urlValue) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFill()
                    default: fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: 30, height: 30)
        .clipShape(circular ? AnyShape(Circle()) : AnyShape(RoundedRectangle(cornerRadius: 8, style: .continuous)))
        .overlay {
            if circular { Circle().stroke(.white.opacity(0.16), lineWidth: 0.75) }
            else { RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(.white.opacity(0.16), lineWidth: 0.75) }
        }
        .accessibilityHidden(true)
    }

    private var fallback: some View {
        Text(initials)
            .font(.system(size: 10, weight: .semibold))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.quaternary)
    }

    private var initials: String {
        String(name.split(separator: " ").compactMap(\.first).prefix(2)).uppercased()
    }
}

private struct TransactionRow: View {
    let transaction: DashboardTransaction

    var body: some View {
        HStack(spacing: 11) {
            Image(systemName: transaction.type == "INCOME" ? "arrow.down.left" : "arrow.up.right")
                .foregroundStyle(transaction.type == "INCOME" ? .green : .secondary)
                .frame(width: 28, height: 28)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.description).font(.caption.weight(.medium)).lineLimit(1)
                Text(dateLabel).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(transaction.type == "INCOME" ? "+" : "−")\(transaction.amount.formatted(.currency(code: "USD")))")
                .font(.caption.weight(.semibold))
                .foregroundStyle(transaction.type == "INCOME" ? .green : .secondary)
        }
        .padding(.vertical, 4)
    }

    private var dateLabel: String {
        guard let date = ISO8601DateFormatter().date(from: transaction.date) else { return "Sin fecha" }
        return date.formatted(.dateTime.day().month(.abbreviated))
    }
}

private struct PipelineOverview: View {
    let stages: [DashboardPipelineStage]

    private var total: Int { stages.reduce(0) { $0 + $1.count } }
    private var blocked: Int { stages.filter { ["REVIEW", "REVIEW_INTERNAL", "REVIEW_CLIENT"].contains($0.key) }.reduce(0) { $0 + $1.count } }
    private let colors: [Color] = [.blue, .purple, .cyan, .indigo, .orange, .green]

    var body: some View {
        HStack(alignment: .center, spacing: 20) {
            ZStack {
                Circle().stroke(.quaternary, lineWidth: 13)
                ForEach(Array(stages.enumerated()), id: \.element.key) { index, stage in
                    Circle()
                        .trim(from: start(index), to: end(index, stage.count))
                        .stroke(colors[index % colors.count], style: StrokeStyle(lineWidth: 13, lineCap: .butt))
                        .rotationEffect(.degrees(-90))
                }
                VStack(spacing: 1) {
                    Text("\(total)").font(.title2.weight(.bold))
                    Text("Total piezas").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .frame(width: 126, height: 126)

            VStack(spacing: 8) {
                ForEach(Array(stages.enumerated()), id: \.element.key) { index, stage in
                    HStack(spacing: 7) {
                        Circle().fill(colors[index % colors.count]).frame(width: 7, height: 7)
                        Text(stage.label).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        Spacer()
                        Text("\(stage.count) (\(percentage(stage.count))%)").font(.caption.weight(.semibold))
                    }
                }
            }
        }
        HStack {
            PipelineStat(label: "Piezas del mes", value: "\(total)")
            Divider()
            PipelineStat(label: "Bloqueadas", value: "\(blocked)", tint: blocked > 0 ? .orange : .primary)
            Divider()
            PipelineStat(label: "Producción media", value: "6,2 días")
        }
        .padding(12)
        .background(.quaternary.opacity(0.45), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func percentage(_ count: Int) -> Int { total == 0 ? 0 : Int((Double(count) / Double(total) * 100).rounded()) }
    private func start(_ index: Int) -> CGFloat { CGFloat(stages.prefix(index).reduce(0) { $0 + $1.count }) / CGFloat(max(total, 1)) }
    private func end(_ index: Int, _ count: Int) -> CGFloat { start(index) + CGFloat(count) / CGFloat(max(total, 1)) }
}

private struct PipelineStat: View {
    let label: String
    let value: String
    var tint: Color = .primary
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            Text(value).font(.subheadline.weight(.semibold)).foregroundStyle(tint).lineLimit(1).minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct PerformanceGrid: View {
    let summary: DashboardSummary
    var body: some View {
        HStack(spacing: 0) {
            PerformanceTile(label: "Tareas completadas", value: "\(summary.publishedThisMonth)", tint: .blue)
            Divider()
            PerformanceTile(label: "Aprobaciones", value: "\(summary.pendingApprovals)", tint: .green)
            Divider()
            PerformanceTile(label: "Prioritarias", value: "\(summary.priorityTasks)", tint: .orange)
        }
    }
}

private struct PerformanceTile: View {
    let label: String
    let value: String
    let tint: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
            Text(value).font(.title3.weight(.bold)).foregroundStyle(tint)
            HStack(spacing: 2) {
                ForEach(0..<7, id: \.self) { index in
                    Capsule().fill(tint.opacity(0.35 + Double(index) * 0.08)).frame(height: CGFloat(4 + index * 2))
                }
            }
            .frame(height: 18, alignment: .bottom)
        }
        .padding(.horizontal, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
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
    var tint: Color = .primary
    var body: some View {
        VStack(alignment: .leading, spacing: 5) { Text(title).font(.caption).foregroundStyle(.secondary); Text(value.map { $0.formatted(.currency(code: "USD")) } ?? "—").font(.headline).foregroundStyle(tint) }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
