import type { IAuthenticateGeneric, ICredentialDataDecryptedObject, ICredentialTestRequest, ICredentialType, IHttpRequestHelper, IHttpRequestOptions, INodeProperties, Icon } from 'n8n-workflow';
import { getMessageFromErrorCode } from '../nodes/SynologyDrive/GenericFunctions';

export class SynologyDriveApi implements ICredentialType {
	name = 'synologyDriveApi';

	displayName = 'Synology Drive API';

	documentationUrl = 'https://office-suite-api.synology.com/Synology-Drive/v1';

	icon: Icon = 'file:../nodes/SynologyDrive/SynologyDrive.svg';

	properties: INodeProperties[] = [
		{
			displayName: 'NAS URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'http://192.168.1.100:5000',
			required: true,
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'DSM username',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
			placeholder: 'DSM password',
		},
		{
			displayName: 'Allow Self-Signed Certificates',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: true,
		},
		{
			displayName: 'Session ID',
			name: 'sid',
			type: 'hidden',
			default: '',
			typeOptions: {
				expirable: true,
			},
		},
		{
			displayName: 'Device ID',
			name: 'deviceId',
			type: 'hidden',
			default: '',
			typeOptions: {
				expirable: true,
			},
		}
	];

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const url = `${credentials.baseUrl}/api/SynologyDrive/default/v1/login`;

		const requestOptions: IHttpRequestOptions = {
			url,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			json: true,
			skipSslCertificateValidation: credentials.allowUnauthorizedCerts as boolean,
			body: {
				format: 'sid',
				account: credentials.username,
				passwd: credentials.password,
			},
		};

		const res = (await this.helpers.httpRequest(requestOptions)) as {
			success: boolean;
			data: {
				did: string;
				sid: string;
			};
			error?: {
				code: number;
			};
		};

		const { success, data, error } = res;

		if (!success) {
			const message = getMessageFromErrorCode(error?.code || 0);
			throw new Error('Failed to login: ' + message);
		}

		return { sid: data.sid, deviceId: data.did };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Cookie': '=id={{$credentials.sid}};',
			},
		},
	};

	/* test: ICredentialTestRequest = {
		request: {
			url: '={{$credentials.baseUrl}}/api/SynologyDrive/default/v1/files/recent',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'Cookie': 'id={{$credentials.sid}}; did={{$credentials.deviceId}};',
			},
		},
	}; */
	/* test: ICredentialTestRequest = {
		request: {
			url: '={{$credentials.baseUrl}}/api/SynologyDrive/default/v1/login',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: {
				format: 'sid',
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	}; */
}
