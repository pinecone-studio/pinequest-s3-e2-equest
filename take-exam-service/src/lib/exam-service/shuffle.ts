const hashString = (value: string) => {
	let hash = 2166136261;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
};

const mulberry32 = (seed: number) => {
	let current = seed;

	return () => {
		current += 0x6d2b79f5;
		let value = Math.imul(current ^ (current >>> 15), current | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

export const shuffleWithSeed = <T,>(items: T[], seedSource: string) => {
	const random = mulberry32(hashString(seedSource));
	const copy = [...items];

	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(random() * (index + 1));
		[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
	}

	return copy;
};
