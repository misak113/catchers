import { useEffect } from "react";

type CancelEffect = () => Promise<void> | void;

export function useAsyncEffect(
	asyncEffect: () => Promise<void | CancelEffect>,
	deps?: React.DependencyList
) {
	useEffect(() => {
		let cancelled = false;
		let cancelAsyncEffect: CancelEffect | undefined;

		asyncEffect().then((cancelAsyncEffectNow) => {
			if (cancelAsyncEffectNow) {
				if (cancelled) {
					cancelAsyncEffectNow();
				} else {
					cancelAsyncEffect = cancelAsyncEffectNow;
				}
			}
		});

		return () => {
			cancelled = true;
			if (cancelAsyncEffect) {
				cancelAsyncEffect();
			}
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
}
