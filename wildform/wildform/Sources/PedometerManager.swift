import Foundation
import CoreMotion

final class PedometerManager: ObservableObject {
    @Published var steps = 0
    @Published var distanceMeters: Double = 0
    @Published var isAvailable = CMPedometer.isStepCountingAvailable()

    private let pedometer = CMPedometer()

    func start() {
        guard CMPedometer.isStepCountingAvailable() else {
            isAvailable = false
            return
        }

        let start = Calendar.current.startOfDay(for: Date())
        pedometer.queryPedometerData(from: start, to: Date()) { [weak self] data, _ in
            DispatchQueue.main.async {
                self?.apply(data)
            }
        }

        pedometer.startUpdates(from: start) { [weak self] data, _ in
            DispatchQueue.main.async {
                self?.apply(data)
            }
        }
    }

    private func apply(_ data: CMPedometerData?) {
        guard let data else { return }
        steps = data.numberOfSteps.intValue
        distanceMeters = data.distance?.doubleValue ?? 0
    }
}
