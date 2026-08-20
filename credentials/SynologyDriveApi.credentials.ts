import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

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
			description:
				'Base URL of DSM or the Synology Drive application portal, without a trailing slash',
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
	];

	test = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/SynologyDrive/default/v1/login',
			method: 'POST' as const,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: {
				format: 'sid',
				account: '={{$credentials.username}}',
				passwd: '={{$credentials.password}}',
			},
			json: true,
			skipSslCertificateValidation: '={{$credentials.allowUnauthorizedCerts}}',
		},
		rules: [
			{
				type: 'responseSuccessBody' as const,
				properties: {
					key: 'success',
					value: true,
					message: 'Login failed: check the NAS URL, username, and password',
				},
			},
		],
	};
}
