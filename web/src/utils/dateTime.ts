const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatDateTime = (
	input: string | number | Date | null | undefined,
	timeZone = "Asia/Shanghai",
) => {
	if (input === null || input === undefined || input === "") {
		return "-";
	}

	const date = new Date(input);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).formatToParts(date);

	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";

	const year = get("year");
	const month = get("month");
	const day = get("day");
	const hour = pad2(Number(get("hour")));
	const minute = pad2(Number(get("minute")));
	const second = pad2(Number(get("second")));

	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};
