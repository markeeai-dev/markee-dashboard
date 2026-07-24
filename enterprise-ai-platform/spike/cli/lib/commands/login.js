'use strict';
const { writeGlobalConfig } = require('../config');
const { ControlPlaneClient } = require('../api');
const { ask } = require('../prompt');

async function run(args) {
  const controlPlaneUrl = args['control-plane-url'] || process.env.CENTERAI_CONTROL_PLANE_URL || 'https://cp.valeron.tech';
  const email = args.email || (await ask('Email công ty'));
  const accessCode = args['access-code'] || (await ask('Mã pilot access code (được cấp riêng)'));

  const client = new ControlPlaneClient(controlPlaneUrl, null);
  const result = await client.login(email, accessCode);

  writeGlobalConfig({
    email,
    employee_id: result.employee_id,
    full_name: result.full_name,
    employee_token: result.employee_token,
    expires_at: result.expires_at,
    control_plane_url: controlPlaneUrl,
  });

  console.log(`Đã đăng nhập: ${result.full_name} (${result.employee_id}). Token hết hạn: ${result.expires_at}`);
}

module.exports = { run };
