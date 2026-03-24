export type BackendHealthResponse = {
	service: "create-exam-service";
	status: "ok";
	timestamp: string;
	version: string;
	api: {
		healthPath: string;
		createExamPath: string;
	};
	notes: string[];
};
