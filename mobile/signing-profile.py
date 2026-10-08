"""Validate a real App Store profile and write Xcode's manual export options."""
import datetime
import os
import pathlib
import plistlib
import re

task_temp = pathlib.Path(os.environ["RUNNER_TEMP"])
team = os.environ["TEAM_ID"]
bundle = "com.folklard.auroria"
with (task_temp / "folklard-profile.plist").open("rb") as stream:
    profile = plistlib.load(stream)

identifier = profile.get("Entitlements", {}).get("application-identifier")
uuid = profile.get("UUID", "")
expiration = profile.get("ExpirationDate")
if (
    profile.get("TeamIdentifier") != [team]
    or identifier != f"{team}.{bundle}"
    or not re.fullmatch(r"[A-Fa-f0-9-]{36}", uuid)
    or not isinstance(expiration, datetime.datetime)
    or expiration <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    or profile.get("Entitlements", {}).get("get-task-allow", True)
    or profile.get("ProvisionedDevices")
    or profile.get("ProvisionsAllDevices")
):
    raise SystemExit("A valid, unexpired App Store distribution profile for Folklard and the configured team is required")

with (task_temp / "folklard-export.plist").open("wb") as stream:
    plistlib.dump({
        "method": "app-store-connect",
        "destination": "export",
        "teamID": team,
        "signingStyle": "manual",
        "signingCertificate": "Apple Distribution",
        "provisioningProfiles": {bundle: uuid},
        "manageAppVersionAndBuildNumber": False,
    }, stream)
with pathlib.Path(os.environ["GITHUB_ENV"]).open("a", encoding="utf-8") as stream:
    stream.write(f"PROFILE_UUID={uuid}\n")
