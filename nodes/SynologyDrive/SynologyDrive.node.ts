import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
} from 'n8n-workflow';
import { ApplicationError, NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import FormData from 'form-data';
import { generatePairedItemData } from './GenericFunctions';

export class SynologyDrive implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Drive',
		name: 'synologyDrive',
		icon: 'file:SynologyDrive.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Synology Drive Node',
		defaults: {
			name: 'Synology Drive',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'synologyDriveApi',
				required: true,
			}
		],
		usableAsTool: true,
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			json: true,
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'File',
						value: 'file',
					},
					{
						name: 'File and Folder Sharing',
						value: 'fileAndFolderSharing',
					},
					{
						name: 'Team Folder',
						value: 'teamFolder',
					},
					{
						name: 'Label',
						value: 'label',
					},
				],
				default: 'file',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['file'],
					},
				},
				options: [
					{
						name: 'Get Files',
						value: 'getFiles',
						action: 'Get files',
						routing: {
							request: {
								method: 'POST',
								url: '/api/SynologyDrive/default/v1/files/list',
								qs: {
									sort_direction: '={{$parameter["sortDirection"]}}', // asc, desc
									sort_by: '={{$parameter["sortBy"]}}', // modified_time ┃ size ┃ owner ┃ type ┃ name
									offset: '={{$parameter["offset"]}}',
									limit: '={{$parameter["limit"]}}',
									path: '={{$parameter["path"]}}',
								},
								body: {
									filter: '={{$parameter["filter"]}}', // object
								}
							},
						},
					},
					{
						name: 'Search',
						value: 'search',
						action: 'Search',
						routing: {
							request: {
								method: 'POST',
								url: '/api/SynologyDrive/default/v1/files/search',
								qs: {
									sort_direction: '={{$parameter["sortDirection"]}}', // asc, desc
									sort_by: '={{$parameter["sortBy"]}}', // modified_time ┃ size ┃ owner ┃ type ┃ name
									offset: '={{$parameter["offset"]}}',
									limit: '={{$parameter["limit"]}}',
								},
								body: {
									keyword: '={{$parameter["keyword"]}}', // object
								}
							},
						},
					},
					{
						name: 'List Items Recently Used',
						value: 'listItemsRecentlyUsed',
						action: 'List items recently used',
						routing: {
							request: {
								method: 'GET',
								url: '/api/SynologyDrive/default/v1/files/recent',
							},
						},
					},
					{
						name: 'Create File Or Folder',
						value: 'createFileOrFolder',
						action: 'Create file or folder',
						routing: {
							send: {
								preSend: [async function (this: IExecuteSingleFunctions,
									requestOptions: IHttpRequestOptions,
								): Promise<IHttpRequestOptions> {
									requestOptions.headers = {
										...requestOptions.headers,
									};
									const type = this.getNodeParameter('createFileOrFolderType') as string;
									if (type === 'file') {
										const fileContent = this.getNodeParameter('createFileOrFolderFileContent') as string;
										requestOptions.body = {
											file_content: Buffer.from(fileContent).toString('base64'),
										};
									}
									return requestOptions;
								}],
							},
							request: {
								method: 'POST',
								url: '/api/SynologyDrive/default/v1/files',
								qs: {
									type: '={{$parameter["createFileOrFolderType"]}}', // file, folder
									path: '={{$parameter["path"]}}',
								},
								body: {
									modified_time: new Date().getTime(),
								}
							},
						},
					},
					{
						name: 'Upload',
						value: 'upload',
						action: 'Upload',
						routing: {
							send: {
								preSend: [async function (this: IExecuteSingleFunctions,
									requestOptions: IHttpRequestOptions,
								): Promise<IHttpRequestOptions> {
									requestOptions.headers = {
										...requestOptions.headers,
									};
									const body = new FormData();

									const binaryPropertyName = this.getNodeParameter('binaryPropertyName') as string;
									if (!binaryPropertyName) {
										throw new NodeOperationError(this.getNode(), 'Binary property name is required');
									}
									const binaryData = this.helpers.assertBinaryData(binaryPropertyName);
									if (!binaryData) {
										throw new NodeOperationError(this.getNode(), 'Binary data is required');
									}
									const fileName = binaryData.fileName?.toString();
									if (!fileName) {
										throw new NodeOperationError(this.getNode(), `File name is needed to upload image. Make sure the property that holds the binary data has the file name property set.`);
									}
									const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(binaryPropertyName);

									const filePath = this.getNodeParameter('path') as string;
									const path = filePath.endsWith('/') ? filePath + fileName : filePath;
									const conflictAction = this.getNodeParameter('uploadConflictAction') as string;

									this.logger.debug(`Upload path: ${path}`);

									body.append('conflict_action', conflictAction);
									body.append('path', path);
									body.append('type', 'file');
									body.append('file', binaryDataBuffer, {
										filename: binaryData.fileName,
										contentType: binaryData.mimeType,
										knownLength: binaryDataBuffer.length,
									});
									requestOptions.body = body;
									requestOptions.headers['Content-Length'] = body.getLengthSync();
									requestOptions.headers['Content-Type'] = `multipart/related; boundary=${body.getBoundary()}`;
									requestOptions.headers['Content-Type'] = 'multipart/form-data';
									return requestOptions;
								}],
							},
							request: {
								method: 'PUT',
								url: '/api/SynologyDrive/default/v1/files/upload',
							},
						},
					},
					{
						name: 'Delete File Or Folder',
						value: 'deleteFileOrFolder',
						action: 'Delete file or folder',
						routing: {
							request: {
								method: 'POST',
								url: '/api/SynologyDrive/default/v1/files/delete',
								body: {
									permanent: '={{$parameter["deleteFileOrFolderPermanent"]}}',
									files: ['={{$parameter["path"]}}'],
								}
							},
						},
					},
					{
						name: 'Download File',
						value: 'downloadFile',
						action: 'Download file',
						routing: {
							send: {
								preSend: [async function (this: IExecuteSingleFunctions,
									requestOptions: IHttpRequestOptions,
								): Promise<IHttpRequestOptions> {
									requestOptions.headers = {
										...requestOptions.headers,
										Accept: '*/*',
									};
									requestOptions.encoding = 'arraybuffer';
									requestOptions.returnFullResponse = true;
									const filePath = this.getNodeParameter('path') as string;
									if (!filePath) {
										throw new NodeOperationError(this.getNode(), 'File paths are required');
									}

									requestOptions.body = {
										force_download: false, // to get correct mime type in response header
										files: [filePath],
									};
									return requestOptions;
								}],
							},
							request: {
								method: 'POST',
								url: '/api/SynologyDrive/default/v1/files/download',
								body: {
									// archive_name: 'download',
									files: ['={{$parameter["path"]}}'],
								}
							},
							output: {
								postReceive: [
									async function (
										this: IExecuteSingleFunctions,
										items,
										response: IN8nHttpFullResponse,
									): Promise<INodeExecutionData[]> {
										const pairedItem = generatePairedItemData(items.length);
										const headers = response.headers as Record<string, string>;
										// this.logger.debug(`Download response headers: ${JSON.stringify(headers)}`);
										const contentType = headers['content-type'] || 'application/octet-stream';
										const binaryDataBuffer = await this.helpers.binaryToBuffer(response.body as Buffer | import('stream').Readable);
										let mimeType = contentType.split(';')[0]?.trim();
										if (mimeType === 'application/json') {
											const bodyString = binaryDataBuffer.toString('utf-8');
											const bodyObject = JSON.parse(bodyString);
											return [
												{
													binary: {},
													json: {
														...bodyObject,
													},
													pairedItem: pairedItem,
												},
											];
										}
										const contentDisposition = headers['content-disposition'] || '';
										const fileName = /filename="([^"]+)"/.exec(contentDisposition)?.[1] || 'download.zip';
										if (mimeType === 'application/octet-stream') {
											mimeType = 'application/zip';
										}

										const binaryData = await this.helpers.prepareBinaryData(binaryDataBuffer, fileName, mimeType);
										return [
											{
												binary: {
													data: binaryData,
												},
												json: {},
												pairedItem: pairedItem,
											},
										];
									}
								],
							},
						},
					},
				],
				default: 'listItemsRecentlyUsed',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				displayOptions: {
					show: {
						operation: [
							'listItemsRecentlyUsed',
							'getFiles',
							'search',
						],
						resource: ['file'],
					},
				},
				description: 'Max number of results to return',
			},
			{
				displayName: 'Type',
				name: 'createFileOrFolderType',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'createFileOrFolder',
						],
					},
				},
				options: [
					{
						name: 'File',
						value: 'file',
					},
					{
						name: 'Folder',
						value: 'folder',
					},
				],
				default: 'folder',
			},
			{
				displayName: 'File Content',
				name: 'createFileOrFolderFileContent',
				type: 'string',
				required: true,
				placeholder: 'Text content',
				hint: 'Text content to be written to the file',
				displayOptions: {
					show: {
						operation: [
							'createFileOrFolder',
						],
						'createFileOrFolderType': ['file'],
					},
				},
				default: '',
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				required: true,
				placeholder: '/mydrive/...',
				// hint: `"link:permanent_link", "id:file_id", "id:file_id/basename", "/mydrive/{relative-path}", "/team-folders/{team-folder-name}/{relative-path}", "/views/{view_id}/{relative-path}", "/volumes/{absolute-path}"`,
				displayOptions: {
					show: {
						operation: [
							'createFileOrFolder',
							'getFiles',
							'upload',
							'downloadFile',
							'deleteFileOrFolder',
						],
					},
				},
				default: '',
			},
			/* {
				displayName: 'Paths',
				name: 'filePaths',
				type: 'json',
				required: true,
				placeholder: '["/mydrive/abc", "/mydrive/def"]',
				displayOptions: {
					show: {
						operation: [
							'deleteFileOrFolder',
						],
					},
				},
				default: '[]',
			}, */
			{
				displayName: 'Delete Permanently',
				name: 'deleteFileOrFolderPermanent',
				type: 'boolean',
				displayOptions: {
					show: {
						operation: [
							'deleteFileOrFolder',
						],
					},
				},
				default: false,
			},
			{
				displayName: 'Sort Direction',
				name: 'sortDirection',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				displayOptions: {
					show: {
						operation: [
							'getFiles', 'search',
						],
					},
				},
			},
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'options',
				options: [
					{ name: 'Modified Time', value: 'modified_time' },
					{ name: 'Size', value: 'size' },
					{ name: 'Owner', value: 'owner' },
					{ name: 'Type', value: 'type' },
					{ name: 'Name', value: 'name' },
				],
				default: 'modified_time',
				displayOptions: {
					show: {
						operation: [
							'getFiles',
							'search',
						],
					},
				},
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						operation: [
							'getFiles', 'search',
						],
					},
				},
			},
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'json',
				default: {},
				displayOptions: {
					show: {
						operation: [
							'getFiles',
						],
					},
				},
				placeholder: '{"extensions": ["jpg", "png"], "types": ["file", "folder", "image"], "label_id": "mylabel", "starred": true}',
			},
			{
				displayName: 'Keyword',
				name: 'keyword',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: [
							'search',
						],
					},
				},
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				hint: 'The name of the input binary field containing the file to be upload',
				displayOptions: {
					show: {
						operation: ['upload'],
					},
				},
				placeholder: 'data',
				description: 'Name of the binary property that contains the data to upload',
			},
			{
				displayName: 'Upload Conflict Action',
				name: 'uploadConflictAction',
				type: 'options',
				options: [
					{ name: 'Overwrite', value: 'overwrite' },
					{ name: 'Autorename', value: 'autorename' },
					{ name: 'Stop', value: 'stop' },
					{ name: 'Version', value: 'version' },
				],
				default: 'version',
				displayOptions: {
					show: {
						operation: [
							'upload',
						],
					},
				},
			},
		],
	};
}
