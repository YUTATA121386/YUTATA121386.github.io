#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GitHub Actions 用：把构建产物打包上传服务器 /kb/ 并重启 poster-gen。

用法：ALI_PWD=<密码> python .github/scripts/deploy-kb.py <dist_tar_gz>
"""
import os
import sys


HOST = "59.110.224.189"
REMOTE_KB = "/opt/poster-gen/web/kb"
REMOTE_TAR = "/tmp/kb-dist.tar.gz"


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: deploy-kb.py <dist_tar_gz>")
    tar_path = sys.argv[1]
    pwd = os.environ.get("ALI_PWD")
    if not pwd:
        raise SystemExit("缺少 ALI_PWD 环境变量")
    import paramiko
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=pwd, timeout=30,
                   look_for_keys=False, allow_agent=False)

    def run(cmd, timeout=300):
        _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        print("$", cmd[:90], "->", code)
        if out.strip():
            print(out.strip()[-400:])
        if err.strip() and code != 0:
            print("ERR:", err.strip()[-400:])
        return code

    sftp = client.open_sftp()
    print("uploading", tar_path)
    sftp.put(tar_path, REMOTE_TAR)
    sftp.close()
    print("uploaded, extracting...")
    if run("rm -rf %s && mkdir -p %s" % (REMOTE_KB, REMOTE_KB)) != 0:
        raise SystemExit("remote kb reset failed")
    if run("tar -xzf %s -C %s && rm -f %s" % (REMOTE_TAR, REMOTE_KB, REMOTE_TAR)) != 0:
        raise SystemExit("remote extract failed")
    run("systemctl restart poster-gen")
    run("sleep 2; curl -s -o /dev/null -w 'kb HTTP %{http_code}\n' http://127.0.0.1/kb/")
    client.close()
    print("DONE")


if __name__ == "__main__":
    main()
