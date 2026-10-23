import { test, expect } from '../../../fixtures/base';

test.describe(
	'Node Details Configuration',
	{
		annotation: [{ type: 'owner', description: 'Catalysts' }],
	},
	() => {
		test.beforeEach(async ({ n8n }) => {
			await n8n.start.fromBlankCanvas();
		});

		test('should configure webhook node', async ({ n8n }) => {
			await n8n.canvas.addNode('Webhook');

			await n8n.ndv.setupHelper.webhook({
				httpMethod: 'POST',
				path: 'test-webhook',
				authentication: 'Basic Auth',
			});

			await expect(n8n.ndv.getParameterInputField('path')).toHaveValue('test-webhook');
		});

		test('should configure HTTP Request node', async ({ n8n }) => {
			await n8n.canvas.addNode('HTTP Request');

			await n8n.ndv.setupHelper.httpRequest({
				method: 'POST',
				url: 'https://api.example.com/test',
				sendQuery: true,
				sendHeaders: false,
			});

			await expect(n8n.ndv.getParameterInputField('url')).toHaveValue(
				'https://api.example.com/test',
			);
		});

		test('should auto-detect parameter types', async ({ n8n }) => {
			await n8n.canvas.addNode('Webhook');

			await n8n.ndv.setupHelper.setParameter('httpMethod', 'PUT');
			await n8n.ndv.setupHelper.setParameter('path', 'auto-detect-test');

			await expect(n8n.ndv.getParameterInputField('path')).toHaveValue('auto-detect-test');
		});

		test('should use explicit types for better performance', async ({ n8n }) => {
			await n8n.canvas.addNode('Webhook');

			await n8n.ndv.setupHelper.setParameter('httpMethod', 'PATCH', 'dropdown');
			await n8n.ndv.setupHelper.setParameter('path', 'explicit-types', 'text');

			await expect(n8n.ndv.getParameterInputField('path')).toHaveValue('explicit-types');
		});

		test('should configure Edit Fields node with single field', async ({ n8n }) => {
			await n8n.canvas.addNode('Edit Fields (Set)');

			await n8n.ndv.editFields.setSingleFieldValue('testField', 'string', 'Hello World');

			const nameInput = n8n.ndv.getAssignmentNameTextbox('assignments', 0);
			await expect(nameInput).toHaveValue('testField');
		});

		test('should configure Edit Fields node with multiple fields', async ({ n8n }) => {
			await n8n.canvas.addNode('Edit Fields (Set)');

			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'stringField', type: 'string', value: 'Test String' },
				{ name: 'numberField', type: 'number', value: 123 },
				{ name: 'booleanField', type: 'boolean', value: true },
			]);

			await expect(n8n.ndv.getAssignments('assignments')).toHaveCount(3);
		});

		test('should configure Edit Fields node with all field types', async ({ n8n }) => {
			await n8n.canvas.addNode('Edit Fields (Set)');

			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'myString', type: 'string', value: 'Hello' },
				{ name: 'myNumber', type: 'number', value: 42 },
				{ name: 'myBoolean', type: 'boolean', value: false },
				{ name: 'myArray', type: 'array', value: '["item1", "item2"]' },
			]);

			await expect(n8n.ndv.getAssignments('assignments')).toHaveCount(4);
		});

		test('should show masked marker for sensitive Edit Fields values', async ({ n8n }) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');

			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'password', type: 'string', value: 'secret-value' },
				{ name: 'token', type: 'string', value: 'token-value' },
			]);
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);
			await n8n.ndv.execute();

			await expect(n8n.ndv.outputPanel.getTable()).toContainText('***');
			const firstMarker = n8n.ndv.outputPanel.getMaskedValueMarkers().first();
			await expect(firstMarker).toBeVisible();
			await expect(firstMarker).toContainText('Masked');
		});

		test('should not draw the Masked label over its lock icon in nested values', async ({
			n8n,
		}) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');

			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'password', type: 'string', value: 'secret-value' },
				{ name: 'creds.token', type: 'string', value: 'nested-token-value' },
			]);
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);
			await n8n.ndv.execute();

			const markers = n8n.ndv.outputPanel.getMaskedValueMarkers();
			await expect(markers).toHaveCount(2);

			for (const marker of await markers.all()) {
				const { iconRight, labelTextLeft } =
					await n8n.ndv.outputPanel.getMaskedValueMarkerEdges(marker);
				expect(iconRight).not.toBeNull();
				expect(labelTextLeft).toBeGreaterThanOrEqual(iconRight!);
			}
		});

		test('should only mark the fields still listed in Fields to Mask', async ({ n8n }) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');

			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'password', type: 'string', value: 'secret-value' },
				{ name: 'token', type: 'string', value: 'plain-token-value' },
				{ name: 'creds.token', type: 'string', value: 'nested-token-value' },
			]);
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);
			await n8n.ndv.execute();

			const markers = n8n.ndv.outputPanel.getMaskedValueMarkers();
			await expect(markers).toHaveCount(3);

			await n8n.ndv.addParameterOptionByName('Fields to Mask');
			await n8n.ndv.fillParameterInputByName('fieldsToMask', 'password');

			await expect(markers).toHaveCount(1);

			await n8n.ndv.execute();

			const table = n8n.ndv.outputPanel.getTable();
			await expect(table).toContainText('plain-token-value');
			await expect(table).toContainText('nested-token-value');
			await expect(markers).toHaveCount(1);
		});

		test('should drop the Masked marker when Mask Sensitive Fields is switched off', async ({
			n8n,
		}) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');

			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'password', type: 'string', value: 'secret-value' },
				{ name: 'token', type: 'string', value: 'plain-token-value' },
			]);
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);
			await n8n.ndv.execute();

			const markers = n8n.ndv.outputPanel.getMaskedValueMarkers();
			await expect(markers).toHaveCount(2);

			await n8n.ndv.setParameterSwitch('maskSensitiveFields', false);

			await expect(markers).toHaveCount(0);

			await n8n.ndv.execute();

			const table = n8n.ndv.outputPanel.getTable();
			await expect(table).toContainText('secret-value');
			await expect(table).toContainText('plain-token-value');
			await expect(markers).toHaveCount(0);
		});

		test('should hide Fields to Set values for masked field names', async ({ n8n }) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');

			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'password', type: 'string', value: 'demo-password-123' },
				{ name: 'name', type: 'string', value: 'Alice' },
			]);
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);

			const passwordValue = n8n.ndv.editFields.getFieldValueInput(0);
			const nameValue = n8n.ndv.editFields.getFieldValueInput(1);
			await expect(passwordValue).toHaveAttribute('type', 'password');
			await expect(nameValue).toHaveAttribute('type', 'text');
			await expect(nameValue).toHaveValue('Alice');

			await n8n.ndv.setParameterSwitch('maskSensitiveFields', false);

			await expect(passwordValue).toHaveAttribute('type', 'text');
			await expect(passwordValue).toHaveValue('demo-password-123');

			await n8n.ndv.execute();

			await expect(n8n.ndv.outputPanel.getTable()).toContainText('demo-password-123');
		});

		test('should mask sensitive upstream fields in the Edit Fields input panel', async ({
			n8n,
		}) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');
			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'username', type: 'string', value: 'demo-user' },
				{ name: 'password', type: 'string', value: 'demo-password-123' },
				{ name: 'token', type: 'string', value: 'demo-token-456' },
			]);
			await n8n.ndv.close();

			await n8n.canvas.addNode('Edit Fields (Set)', { fromNode: 'Edit Fields' });
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);
			await n8n.ndv.executePrevious();

			const inputData = n8n.ndv.inputPanel.getDataContainer();
			const markers = n8n.ndv.inputPanel.getMaskedValueMarkers();
			for (const mode of ['table', 'json', 'schema'] as const) {
				await test.step(`${mode} view`, async () => {
					await n8n.ndv.inputPanel.switchDisplayMode(mode);

					await expect(inputData).toContainText('demo-user');
					await expect(inputData).toContainText('***');
					await expect(inputData).not.toContainText('demo-password-123');
					await expect(inputData).not.toContainText('demo-token-456');
					await expect(markers).toHaveCount(2);
					await expect(markers.first()).toContainText('Masked');
				});
			}
		});

		test('should show upstream values unchanged when masking is off', async ({ n8n }) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');
			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'username', type: 'string', value: 'demo-user' },
				{ name: 'password', type: 'string', value: 'demo-password-123' },
				{ name: 'token', type: 'string', value: 'demo-token-456' },
			]);
			await n8n.ndv.close();

			await n8n.canvas.addNode('Edit Fields (Set)', { fromNode: 'Edit Fields' });
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', false);
			await n8n.ndv.executePrevious();

			const inputData = n8n.ndv.inputPanel.getDataContainer();
			for (const mode of ['table', 'json', 'schema'] as const) {
				await test.step(`${mode} view`, async () => {
					await n8n.ndv.inputPanel.switchDisplayMode(mode);

					await expect(inputData).toContainText('demo-user');
					await expect(inputData).toContainText('demo-password-123');
					await expect(inputData).toContainText('demo-token-456');
					await expect(n8n.ndv.inputPanel.getMaskedValueMarkers()).toHaveCount(0);
				});
			}
		});

		test('should mark masked values in the output JSON and schema views', async ({ n8n }) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');
			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'username', type: 'string', value: 'demo-user' },
				{ name: 'password', type: 'string', value: 'demo-password-123' },
				{ name: 'token', type: 'string', value: 'demo-token-456' },
			]);
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);
			await n8n.ndv.execute();

			const outputPanel = n8n.ndv.outputPanel;
			const outputData = outputPanel.getDataContainer();
			const markers = outputPanel.getMaskedValueMarkers();
			const views = [
				{ mode: 'json', content: outputPanel.getJsonDataContainer() },
				{ mode: 'schema', content: outputPanel.getSchemaItem('username') },
			] as const;
			for (const { mode, content } of views) {
				await test.step(`${mode} view`, async () => {
					await outputPanel.switchDisplayMode(mode);

					await expect(content).toBeVisible();
					await expect(outputData).toContainText('demo-user');
					await expect(outputData).toContainText('***');
					await expect(outputData).not.toContainText('demo-password-123');
					await expect(outputData).not.toContainText('demo-token-456');
					await expect(markers).toHaveCount(2);
					await expect(markers.first()).toContainText('Masked');
				});
			}
		});

		test('should apply a narrowed Fields to Mask list to the input panel and value boxes', async ({
			n8n,
		}) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');
			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'username', type: 'string', value: 'demo-user' },
				{ name: 'password', type: 'string', value: 'demo-password-123' },
				{ name: 'token', type: 'string', value: 'demo-token-456' },
			]);
			await n8n.ndv.close();

			await n8n.canvas.addNode('Edit Fields (Set)', { fromNode: 'Edit Fields' });
			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'password', type: 'string', value: 'own-password-value' },
				{ name: 'token', type: 'string', value: 'own-token-value' },
			]);
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);
			await n8n.ndv.executePrevious();
			await n8n.ndv.inputPanel.switchDisplayMode('table');

			const inputTable = n8n.ndv.inputPanel.getTable();
			const inputMarkers = n8n.ndv.inputPanel.getMaskedValueMarkers();
			const passwordValue = n8n.ndv.editFields.getFieldValueInput(0);
			const tokenValue = n8n.ndv.editFields.getFieldValueInput(1);
			await expect(inputTable).toContainText('demo-user');
			await expect(inputTable).not.toContainText('demo-password-123');
			await expect(inputTable).not.toContainText('demo-token-456');
			await expect(inputMarkers).toHaveCount(2);
			await expect(passwordValue).toHaveAttribute('type', 'password');
			await expect(tokenValue).toHaveAttribute('type', 'password');

			await n8n.ndv.addParameterOptionByName('Fields to Mask');
			await n8n.ndv.fillParameterInputByName('fieldsToMask', 'password');

			await expect(inputTable).toContainText('demo-token-456');
			await expect(inputTable).not.toContainText('demo-password-123');
			await expect(inputMarkers).toHaveCount(1);
			await expect(passwordValue).toHaveAttribute('type', 'password');
			await expect(tokenValue).toHaveAttribute('type', 'text');
			await expect(tokenValue).toHaveValue('own-token-value');
		});

		test('should mask nothing when Fields to Mask is cleared', async ({ n8n }) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');
			await n8n.ndv.editFields.setFieldsValues([
				{ name: 'password', type: 'string', value: 'secret-value' },
				{ name: 'token', type: 'string', value: 'plain-token-value' },
			]);
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);

			const passwordValue = n8n.ndv.editFields.getFieldValueInput(0);
			const tokenValue = n8n.ndv.editFields.getFieldValueInput(1);
			await expect(passwordValue).toHaveAttribute('type', 'password');

			await n8n.ndv.addParameterOptionByName('Fields to Mask');
			await n8n.ndv.fillParameterInputByName('fieldsToMask', '');

			await expect(passwordValue).toHaveAttribute('type', 'text');
			await expect(passwordValue).toHaveValue('secret-value');
			await expect(tokenValue).toHaveAttribute('type', 'text');
			await expect(tokenValue).toHaveValue('plain-token-value');

			await n8n.ndv.execute();

			const table = n8n.ndv.outputPanel.getTable();
			await expect(table).toContainText('secret-value');
			await expect(table).toContainText('plain-token-value');
			await expect(table).not.toContainText('***');
			await expect(n8n.ndv.outputPanel.getMaskedValueMarkers()).toHaveCount(0);
		});

		test('should keep an expression value readable in a masked field', async ({ n8n }) => {
			await n8n.canvas.addNode('Manual Trigger');
			await n8n.canvas.addNode('Edit Fields (Set)');
			await n8n.ndv.getAssignmentCollectionAdd('assignments').click();
			await n8n.ndv.clickAssignmentExpressionToggle('assignments');
			await n8n.ndv.clearExpressionEditor();
			// The editor closes `{{` with ` }}` on its own, so typing the closing braces would double them.
			await n8n.ndv.typeInExpressionEditor("{{'demo-' + 'expression-value'");
			await n8n.ndv.getAssignmentNameTextbox('assignments').fill('password');
			await n8n.ndv.addParameterOptionByName('Mask Sensitive Fields');
			await n8n.ndv.setParameterSwitch('maskSensitiveFields', true);

			const expressionInput = n8n.ndv.getInlineExpressionEditorInput();
			await expect(expressionInput).toBeVisible();
			await expect(expressionInput).toHaveText("{{ 'demo-' + 'expression-value' }}");
			await expect(n8n.ndv.editFields.getFieldValueInput(0)).not.toHaveAttribute(
				'type',
				'password',
			);

			await n8n.ndv.execute();

			const table = n8n.ndv.outputPanel.getTable();
			await expect(table).toContainText('***');
			await expect(table).not.toContainText('demo-expression-value');
			await expect(n8n.ndv.outputPanel.getMaskedValueMarkers()).toHaveCount(1);
		});
	},
);
